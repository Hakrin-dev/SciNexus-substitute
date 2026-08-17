"""混合证据检索：BM25 关键词 + 本地 TF-IDF 字符相似度 + RRF 排名融合。

移植自队友架构（academic-agents），用于「论文内部证据检索」：
输入 = 论文 chunks + 用户问题；输出 = 按相关度排序的 {page, chunk_id, text, score} 证据片段，
供 Synthesis 依据证据作答并标注页码。
"""
from __future__ import annotations

import math
import re
from collections import Counter
from dataclasses import dataclass
from typing import Any

# 兼容 dict 或 PaperChunk 两种 chunk 表示
def _chunk_text(chunk: Any) -> str:
    return chunk.get("text", "") if isinstance(chunk, dict) else chunk.text


def _chunk_id(chunk: Any) -> str:
    return chunk.get("chunk_id", "") if isinstance(chunk, dict) else chunk.chunk_id


def _chunk_page(chunk: Any) -> int:
    return int(chunk.get("page", 0)) if isinstance(chunk, dict) else chunk.page


@dataclass(frozen=True)
class PaperChunk:
    page: int
    chunk_id: str
    text: str


def _tokens(text: str) -> list[str]:
    lowered = text.lower()
    words = re.findall(r"[a-z0-9][a-z0-9_-]+", lowered)
    chinese_runs = re.findall(r"[\u4e00-\u9fff]+", lowered)
    chinese_tokens: list[str] = []
    for run in chinese_runs:
        chinese_tokens.extend(run[index : index + 2] for index in range(len(run) - 1))
        chinese_tokens.extend(run[index : index + 3] for index in range(len(run) - 2))
    return words + chinese_tokens


def _char_ngrams(text: str, minimum: int = 2, maximum: int = 4) -> Counter[str]:
    normalized = re.sub(r"\s+", " ", text.lower()).strip()
    grams: Counter[str] = Counter()
    for size in range(minimum, maximum + 1):
        grams.update(
            normalized[index : index + size]
            for index in range(max(0, len(normalized) - size + 1))
        )
    return grams


def _bm25_scores(chunks: list[Any], question: str) -> list[float]:
    documents = [_tokens(_chunk_text(chunk)) for chunk in chunks]
    query_terms = _tokens(question)
    if not query_terms:
        return [0.0] * len(chunks)
    average_length = sum(len(doc) for doc in documents) / max(1, len(documents))
    document_frequency = Counter(
        term for doc in documents for term in set(doc)
    )
    scores: list[float] = []
    for document in documents:
        frequencies = Counter(document)
        score = 0.0
        for term in query_terms:
            frequency = frequencies[term]
            if not frequency:
                continue
            inverse_frequency = math.log(
                1 + (len(documents) - document_frequency[term] + 0.5)
                / (document_frequency[term] + 0.5)
            )
            denominator = frequency + 1.5 * (
                1 - 0.75 + 0.75 * len(document) / max(1, average_length)
            )
            score += inverse_frequency * frequency * 2.5 / denominator
        scores.append(score)
    return scores


def _tfidf_scores(chunks: list[Any], question: str) -> list[float]:
    document_vectors = [_char_ngrams(_chunk_text(chunk)) for chunk in chunks]
    query_vector = _char_ngrams(question)
    if not query_vector:
        return [0.0] * len(chunks)
    document_frequency = Counter(
        gram for vector in document_vectors for gram in vector
    )
    idf = {
        gram: math.log((1 + len(chunks)) / (1 + frequency)) + 1
        for gram, frequency in document_frequency.items()
    }

    def weighted(vector: Counter[str]) -> dict[str, float]:
        return {
            gram: frequency * idf.get(gram, 1.0)
            for gram, frequency in vector.items()
        }

    query_weights = weighted(query_vector)
    query_norm = math.sqrt(sum(v * v for v in query_weights.values()))
    scores: list[float] = []
    for vector in document_vectors:
        document_weights = weighted(vector)
        document_norm = math.sqrt(sum(v * v for v in document_weights.values()))
        dot = sum(v * document_weights.get(gram, 0.0) for gram, v in query_weights.items())
        scores.append(dot / (query_norm * document_norm) if query_norm and document_norm else 0.0)
    return scores


def hybrid_retrieve(chunks: list[Any], question: str, limit: int = 6) -> list[dict[str, Any]]:
    """返回按相关度排序的证据片段 [{page, chunk_id, text, keyword_score, vector_score, rrf_score}]。"""
    if not chunks or not question.strip():
        return []
    keyword_scores = _bm25_scores(chunks, question)
    vector_scores = _tfidf_scores(chunks, question)
    keyword_order = sorted(range(len(chunks)), key=lambda i: keyword_scores[i], reverse=True)
    vector_order = sorted(range(len(chunks)), key=lambda i: vector_scores[i], reverse=True)
    keyword_rank = {index: rank + 1 for rank, index in enumerate(keyword_order)}
    vector_rank = {index: rank + 1 for rank, index in enumerate(vector_order)}

    ranked = sorted(
        range(len(chunks)),
        key=lambda i: (
            1 / (60 + keyword_rank[i]) + 1 / (60 + vector_rank[i]),
            keyword_scores[i] + vector_scores[i],
        ),
        reverse=True,
    )
    results: list[dict[str, Any]] = []
    for index in ranked[: max(1, limit)]:
        chunk = chunks[index]
        results.append(
            {
                "page": _chunk_page(chunk),
                "chunk_id": _chunk_id(chunk),
                "text": _chunk_text(chunk),
                "keyword_score": round(keyword_scores[index], 6),
                "vector_score": round(vector_scores[index], 6),
                "rrf_score": round(1 / (60 + keyword_rank[index]) + 1 / (60 + vector_rank[index]), 6),
            }
        )
    return results


def build_structured_analysis(chunks: list[Any]) -> dict[str, Any]:
    """按章节关键词做结构化证据摘录（摘要/方法/实验/局限）。"""
    sections = {
        "summary": "abstract introduction research problem contribution 摘要 研究问题 贡献",
        "core_innovation": "innovation contribution propose novel propose new method 创新 贡献 提出 新方法 主要贡献",
        "methodology": "method methodology approach architecture algorithm 方法 模型 算法",
        "experiments": "experiment dataset baseline metric result table 实验 数据集 指标 结果",
        "limitations": "limitation discussion future work weakness 局限 不足 未来工作",
    }
    analysis: dict[str, Any] = {}
    for section_name, query in sections.items():
        evidence = hybrid_retrieve(chunks, query, limit=3)
        analysis[section_name] = {
            "content": "\n\n".join(item["text"] for item in evidence),
            "evidence": [
                {"page": item["page"], "chunk_id": item["chunk_id"], "quote": item["text"]}
                for item in evidence
            ],
        }
    analysis["note"] = (
        "这是基于章节关键词和本地 TF-IDF/BM25 检索得到的结构化证据摘录；"
        "正式结论应结合原始 PDF 和真实模型复核。"
    )
    return analysis
