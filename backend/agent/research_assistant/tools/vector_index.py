"""向量索引：语义检索。

优先使用 Ollama 本地 embedding 模型（nomic-embed-text）做余弦相似度；
若 Ollama 不可用/模型缺失，自动降级为词法 TF 打分，保证可用性。

向量持久化到 server/data/embeddings.json（按模型名缓存），避免每次启动重复计算。

注：环境无法快速安装 chromadb（依赖过重），故用轻量内存向量索引实现，
接口与 ChromaDB 对齐，后续可平滑替换。
"""
from __future__ import annotations

import json
import math
import urllib.error
import urllib.request
from collections import Counter
from pathlib import Path
from typing import Any

import numpy as np

from research_assistant.config import settings
from research_assistant.tools.data_source import DATA_DIR
from research_assistant.tools.text_utils import tokenize_query


def rrf_fuse(ranked_lists: list[list[dict]], k: int = 60,
             weights: list[float] | None = None) -> list[dict[str, Any]]:
    """倒数排名融合（Reciprocal Rank Fusion）：融合多个已排序的召回列表。

    每个列表为 [{paper_id, score}]，按 score 降序。RRF 只看排名不看原始分数，
    因此可融合不同量纲的信号（余弦相似度 / BM25 饱和分 / 图 PageRank）。
    k 为平滑常数（常取 60），越大排名差异的权重越小。
    weights 为每路召回的权重（默认等权 1.0）；如语义优先可用 [2.0, 1.0, 0.5]。

    返回按融合分降序的 [{paper_id, score}]；score 归一化到 0..1（除以非空
    列表的权重和对应的理论最大分），反映「多路召回加权共识强度」。
    """
    if weights is None:
        weights = [1.0] * len(ranked_lists)
    fused: dict[str, float] = {}
    for w, lst in zip(weights, ranked_lists):
        for rank, item in enumerate(lst, start=1):
            pid = item["paper_id"]
            fused[pid] = fused.get(pid, 0.0) + w / (k + rank)
    max_score = sum(w for w, lst in zip(weights, ranked_lists) if lst) / (k + 1.0)
    if max_score <= 0:
        return []
    ranked = sorted(fused.items(), key=lambda kv: -kv[1])
    return [{"paper_id": pid, "score": round(sc / max_score, 4)} for pid, sc in ranked]


class VectorIndex:
    def __init__(self, papers: list[dict], model: str = "nomic-embed-text",
                 base_url: str | None = None) -> None:
        self.papers = papers
        self.model = model
        self.base_url = (base_url or settings.ollama_base_url).rstrip("/")
        self.base_dir = str(DATA_DIR)
        self._vecs: dict[str, np.ndarray] = {}
        self._mode: str = "lexical"  # semantic | lexical
        self._build()
        self._build_lexical_stats()

    # ------------------------------------------------------------------ #
    # embedding
    # ------------------------------------------------------------------ #
    def _embed(self, text: str) -> np.ndarray | None:
        body = json.dumps({"model": self.model, "prompt": text}).encode("utf-8")
        req = urllib.request.Request(
            f"{self.base_url}/api/embeddings",
            data=body,
            headers={"Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                raw = json.loads(resp.read().decode("utf-8"))
            return np.asarray(raw.get("embedding", []), dtype=np.float32)
        except (urllib.error.URLError, urllib.error.HTTPError, ValueError, KeyError):
            return None

    def _build(self) -> None:
        """为每篇论文的 title+abstract+keywords 建立向量；失败则用词法模式。

        向量持久化到 server/data/embeddings.json，避免每次启动重复计算。
        允许部分论文 embedding 失败（用零向量占位），只要成功率足够高即启用语义模式。
        """
        cache = self._load_cache()
        missing = [p for p in self.papers if p["paper_id"] not in cache]
        for p in missing:
            v = self._embed(self._paper_text(p))
            if v is not None:
                cache[p["paper_id"]] = v.tolist()
        self._save_cache(cache)

        ok = sum(1 for pid in (p["paper_id"] for p in self.papers) if pid in cache)
        if cache and ok >= max(3, int(len(self.papers) * 0.5)):
            dim = len(next(iter(cache.values())))
            self._vecs = {
                p["paper_id"]: np.asarray(cache.get(p["paper_id"], [0.0] * dim), dtype=np.float32)
                for p in self.papers
            }
            self._mode = "semantic"
        else:
            self._mode = "lexical"

    # ------------------------------------------------------------------ #
    # 向量缓存
    # ------------------------------------------------------------------ #
    @property
    def _cache_path(self) -> Path:
        return Path(self.base_dir) / "embeddings.json"

    def _load_cache(self) -> dict[str, list[float]]:
        try:
            data = json.loads(self._cache_path.read_text(encoding="utf-8"))
            if data.get("model") == self.model:
                return data.get("vectors") or {}
        except (OSError, ValueError):
            pass
        return {}

    def _save_cache(self, cache: dict[str, list[float]]) -> None:
        try:
            self._cache_path.parent.mkdir(parents=True, exist_ok=True)
            self._cache_path.write_text(
                json.dumps({"model": self.model, "vectors": cache}, ensure_ascii=False), encoding="utf-8"
            )
        except OSError:
            pass

    @staticmethod
    def _paper_text(p: dict) -> str:
        return " ".join(filter(None, [p.get("title", ""), p.get("abstract", ""),
                                      " ".join(p.get("keywords", []))]))

    # ------------------------------------------------------------------ #
    # 词法（BM25）预计算
    # ------------------------------------------------------------------ #
    def _build_lexical_stats(self) -> None:
        """一次性预计算词法检索（BM25）所需统计量。

        - self._doc_freqs: 每篇论文 token -> 词频（tokenize_query 已去重，tf∈{0,1}）
        - self._doc_lens:  每篇论文的 token 文档长度（用于长度归一化）
        - self._df:        语料级文档频率（token 出现在多少篇论文中，用于 IDF）
        - self._avgdl:     平均文档长度

        在 __init__ 中调用一次，避免每次查询重复 tokenize 全库。
        """
        self._doc_freqs: dict[str, Counter[str]] = {}
        self._doc_lens: dict[str, int] = {}
        self._df: Counter[str] = Counter()
        for p in self.papers:
            tokens = tokenize_query(self._paper_text(p))
            self._doc_freqs[p["paper_id"]] = Counter(tokens)
            self._doc_lens[p["paper_id"]] = len(tokens)
            self._df.update(set(tokens))
        total = sum(self._doc_lens.values())
        self._avgdl = total / len(self.papers) if self.papers else 0.0

    # ------------------------------------------------------------------ #
    # 查询
    # ------------------------------------------------------------------ #
    def search_dense(self, query: str, top_k: int = 10) -> list[dict[str, Any]]:
        """稠密向量检索（cosine 0..1）；非 semantic 模式或 query embedding 失败返回 []。"""
        if self._mode != "semantic":
            return []
        qv = self._embed(query)
        if qv is None:
            return []
        scores = {pid: float(np.dot(v, qv) / (np.linalg.norm(v) * np.linalg.norm(qv) + 1e-9))
                  for pid, v in self._vecs.items()}
        ranked = sorted(scores.items(), key=lambda kv: -kv[1])
        return [{"paper_id": pid, "score": sc} for pid, sc in ranked[:top_k]]

    def search_sparse(self, query: str, top_k: int = 10) -> list[dict[str, Any]]:
        """BM25 词法检索（饱和分 0..1，总是可用）。"""
        return self._lexical_search(query, top_k)

    def search(self, query: str, top_k: int = 10) -> list[dict[str, Any]]:
        """兼容旧接口：稠密优先、失败降级 BM25（单一信号，非融合）。"""
        dense = self.search_dense(query, top_k)
        if dense:
            return dense
        return self._lexical_search(query, top_k)

    def hybrid_search(self, query: str, top_k: int = 10) -> list[dict[str, Any]]:
        """稠密 + BM25 两路加权 RRF（稠密 2.0 : BM25 1.0，语义优先）。"""
        return rrf_fuse(
            [self.search_dense(query, top_k), self._lexical_search(query, top_k)],
            weights=[2.0, 1.0],
        )[:top_k]

    def _lexical_search(self, query: str, top_k: int) -> list[dict[str, Any]]:
        """BM25 词法打分：Σ_t idf(t) * tf*(k1+1) / (tf + k1*(1 - b + b*|D|/avgdl))。

        相比原始 raw TF 计数，加入 IDF 稀有度权重（ln((N-df+0.5)/(df+0.5)+1)）
        与文档长度归一化（k1=1.5, b=0.75），返回按相关度降序的 [{paper_id, score}]。
        score 为原始 BM25 值（scout 端再做 min-max 归一化到 0..1）。
        """
        tokens = tokenize_query(query)
        if not tokens or not self.papers:
            return []
        n = len(self.papers)
        avgdl = self._avgdl if self._avgdl > 0 else 1.0
        k1, b = 1.5, 0.75
        scored = []
        for p in self.papers:
            pid = p["paper_id"]
            freq = self._doc_freqs.get(pid)
            if freq is None:
                continue
            doc_len = self._doc_lens.get(pid, 0)
            score = 0.0
            for t in tokens:
                df = self._df.get(t, 0)
                if df == 0:
                    continue  # 语料中不存在的 token，无检索价值
                tf = freq.get(t, 0)
                if tf == 0:
                    continue
                idf = math.log((n - df + 0.5) / (df + 0.5) + 1)
                denom = tf + k1 * (1 - b + b * doc_len / avgdl)
                score += idf * tf * (k1 + 1) / denom
            if score > 0:
                # 饱和映射到 0..1：绝对相关度（score/(score+1)），
                # 避免「结果集内最高分」被后续 min-max 强制放大成 100%。
                scored.append({"paper_id": pid, "score": float(score / (score + 1.0))})
        scored.sort(key=lambda d: -d["score"])
        return scored[:top_k]

    @property
    def mode(self) -> str:
        return self._mode
