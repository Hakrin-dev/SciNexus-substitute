"""交叉编码器重排（可选第二检索阶段）。

在混合检索（RRF）召回候选后，用交叉编码器对 (query, doc) 成对精排，
比双编码器的余弦相似度更精准，能区分「transformer 架构」vs「transformer 应用」
这类语义边界案例。

可选依赖：sentence-transformers（模型见 settings.rerank_model）。
未安装或模型加载失败时优雅降级——跳过重排，直接沿用 RRF 分数与顺序。
"""
from __future__ import annotations

import math
from typing import Any

from research_assistant.config import settings


class CrossEncoderReranker:
    """交叉编码器重排器：惰性加载，不可用则静默降级。"""

    def __init__(self, model_name: str | None = None) -> None:
        self.model_name = model_name or settings.rerank_model
        self._model: Any = None
        self._tried = False

    @property
    def available(self) -> bool:
        self._ensure_loaded()
        return self._model is not None

    def _ensure_loaded(self) -> None:
        if self._tried:
            return
        self._tried = True
        try:
            import os  # noqa: PLC0415

            # sentence-transformers 只需 torch；跳过 transformers 的 TF 导入，
            # 避免环境里 Keras 3 / TensorFlow 与 transformers 的兼容冲突。
            os.environ.setdefault("USE_TF", "0")
            os.environ.setdefault("TRANSFORMERS_NO_TF", "1")
            # 国内用 hf-mirror.com 镜像下载模型，规避 huggingface.co 被墙
            os.environ.setdefault("HF_ENDPOINT", settings.hf_endpoint)
        except Exception:
            pass
        self._model = self._load_with_timeout()

    def _load_with_timeout(self, timeout: float = 30.0) -> Any:
        """后台线程加载模型；超时（如首次下载模型卡在慢网）则返回 None，不阻塞检索。"""
        import threading  # noqa: PLC0415

        result: dict[str, Any] = {}

        def _load() -> None:
            try:
                from sentence_transformers import CrossEncoder  # noqa: PLC0415

                result["model"] = CrossEncoder(self.model_name)
            except Exception:
                result["model"] = None

        t = threading.Thread(target=_load, daemon=True)
        t.start()
        t.join(timeout)
        if t.is_alive():
            return None
        return result.get("model")

    @staticmethod
    def _doc_text(p: dict) -> str:
        text = " ".join(filter(None, [p.get("title", ""), p.get("abstract", "")]))
        return text[:1000] or p.get("paper_id", "")

    def rerank(self, query: str, papers: list[dict], top_k: int) -> list[dict]:
        """对候选论文做 (query, doc) 交叉编码精排，覆盖 relevance_score 为交叉编码分。

        模型不可用或打分失败时原序返回（保持 RRF 分数与顺序）。
        """
        self._ensure_loaded()
        if self._model is None or not papers:
            return papers[:top_k]
        pairs = [(query, self._doc_text(p)) for p in papers]
        try:
            raw = self._model.predict(pairs)
        except Exception:
            return papers[:top_k]
        for p, s in zip(papers, raw):
            # sigmoid 单调映射到 0..1（兼容 logits 与已归一化模型的输出）
            p["relevance_score"] = round(float(1.0 / (1.0 + math.exp(-float(s)))), 4)
        papers.sort(key=lambda p: -p.get("relevance_score", 0.0))
        return papers[:top_k]


reranker = CrossEncoderReranker()
