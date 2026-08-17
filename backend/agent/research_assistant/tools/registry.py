"""工具与底层资源统一封装（统一调度双图谱数据、外部工具连接）。

由 Supervisor 授权控制（authorized_for），防止 agent 故障滥用。
工具实现接入 data_source 组装的数据后端：
- SQLite（store）：论文元数据检索 / 会议库
- 向量索引（vector）：语义检索（Ollama embedding，词法降级）
- networkx 图谱（graph）：引用关系扩展 / 图谱检索
- PDF 文件（server/data/pdfs/）：pdf_parser 解析真实全文
"""
from __future__ import annotations

import re
from contextlib import contextmanager
from contextvars import ContextVar
from typing import Any, Callable

from research_assistant.tools.data_source import DATA_DIR, backend
from research_assistant.tools.pdf import parse_pdf

_ToolFn = Callable[..., Any]


class ToolRegistry:
    def __init__(self) -> None:
        self._tools: dict[str, _ToolFn] = {}
        self._authorization: ContextVar[tuple[str, frozenset[str]] | None] = ContextVar(
            "tool_authorization", default=None
        )
        self._register_defaults()

    def _register_defaults(self) -> None:
        self.register("vector_rag", lambda query, top_k=10, filters=None: self._search(query, top_k, filters))
        self.register("graph_rag", lambda query, top_k=10, filters=None: self._graph_search(query, top_k, filters))
        self.register("pdf_parser", lambda paper_id: parse_pdf(paper_id, pdf_dir=DATA_DIR / "pdfs"))
        self.register("graph_expand", lambda seed_ids, depth=2, relation="co-citation": backend.graph.expand(seed_ids, depth, relation))
        self.register("venue_db", lambda query: backend.store.query_venues(query))
        self.register("evidence_check", lambda cited_ids, evidence: [c for c in cited_ids if c in evidence])
        self.register("dpo_align", lambda text, style: f"[{style} 风格对齐] {text}")
        # 论文内证据检索：BM25 + TF-IDF + RRF（移植自队友架构）
        self.register(
            "evidence_retrieve",
            lambda paper_id, question, limit=6: self._evidence_retrieve(paper_id, question, limit),
        )
        # PDF 安全下载入库（SSRF 防护 + %PDF 头校验 + 30MB 限制）
        self.register("pdf_ingest", lambda url: self._pdf_ingest(url))

    def register(self, name: str, fn: _ToolFn) -> None:
        self._tools[name] = fn

    def call(self, name: str, **kwargs: Any) -> Any:
        if name not in self._tools:
            raise KeyError(f"未知工具: {name}")
        authorization = self._authorization.get()
        if authorization is not None:
            agent, allowed_tools = authorization
            if name not in allowed_tools:
                raise PermissionError(f"tool_authorization_denied: agent={agent}, tool={name}")
        return self._tools[name](**kwargs)

    @property
    def names(self) -> frozenset[str]:
        return frozenset(self._tools)

    @contextmanager
    def authorized_for(self, agent: str, allowed_tools: list[str]):
        """在单个 agent 执行期间启用 Supervisor 授予的最小工具权限。"""
        token = self._authorization.set((agent, frozenset(allowed_tools)))
        try:
            yield
        finally:
            self._authorization.reset(token)

    # ------------------------------------------------------------------ #
    # 检索实现
    # ------------------------------------------------------------------ #
    @staticmethod
    def _filters_ok(p: dict, filters: dict | None) -> bool:
        filters = filters or {}
        rng = filters.get("time_range")
        if rng and len(rng) == 2 and not (rng[0] <= p.get("year", 0) <= rng[1]):
            return False
        ccf = filters.get("ccf")
        if ccf and p.get("ccf") != ccf:
            return False
        if filters.get("venue") and filters["venue"].lower() not in str(p.get("venue", "")).lower():
            return False
        return True

    @staticmethod
    def _kw_query(query: str, filters: dict | None) -> str:
        """用 core_topics 拼接作为检索关键词（中文无空格，子串匹配更可靠）。"""
        topics = [t for t in (filters or {}).get("core_topics") or [] if t]
        return " ".join(topics) if topics else query

    def _search(self, query: str, top_k: int = 10, filters: dict | None = None) -> list[dict]:
        """vector_rag：向量语义 + SQL 关键词 混合召回。

        每篇论文附带 `_score` 相关度（余弦 0..1 / BM25 原始值；未命中向量的
        SQL 论文为 0.0），按 (-_score, citation_count) 排序。`_score` 保留在返回
        dict 上，供 scout 读取后归一化。
        """
        filters = filters or {}
        # 召回关键词：core_topics 宽召回；相关度打分用原始 query（不被 LLM 扩写稀释）
        kw = self._kw_query(query, filters)
        pool = {p["paper_id"]: p for p in backend.store.search(kw, top_k=top_k * 3, filters=filters)}
        # 语义命中的论文若不在 SQL 候选里也加入（只要满足过滤条件）
        for hit in backend.vector.search(query, top_k * 3):
            pid = hit["paper_id"]
            if pid in pool:
                pool[pid]["_score"] = hit["score"]
            else:
                p = backend.get_paper(pid)
                if p and self._filters_ok(p, filters):
                    p = dict(p)
                    p["_score"] = hit["score"]
                    pool[pid] = p
        # 未命中向量的 SQL 论文相关度为 0
        for p in pool.values():
            p.setdefault("_score", 0.0)
        ranked = sorted(pool.values(), key=lambda p: (-p.get("_score", 0.0), -p.get("citation_count", 0)))
        return ranked[:top_k]

    def _graph_search(self, query: str, top_k: int = 10, filters: dict | None = None) -> list[dict]:
        """graph_rag：基于引用子图的 PageRank 检索。

        每篇论文附带 `_score`（PageRank ~0..1），按 (-_score, citation_count) 排序，
        同样保留 `_score` 供 scout 读取。
        """
        filters = filters or {}
        hits = backend.graph.search(query, top_k, filters)
        results = []
        for h in hits:
            p = backend.get_paper(h["paper_id"])
            if not p or not self._filters_ok(p, filters):
                continue
            out = dict(p)
            out["_score"] = h["score"]
            results.append(out)
        results.sort(key=lambda p: (-p.get("_score", 0.0), -p.get("citation_count", 0)))
        return results[:top_k]

    # ------------------------------------------------------------------ #
    # 论文内证据检索 / PDF 安全入库
    # ------------------------------------------------------------------ #
    def _evidence_retrieve(self, paper_id: str, question: str, limit: int = 6) -> dict:
        """解析论文并做混合证据检索，返回 {paper_id, query, evidence, source}。"""
        from research_assistant.tools.evidence import DocumentStore, hybrid_retrieve  # noqa: PLC0415

        chunks = []
        source = None
        if len(paper_id) == 64 and all(c in "0123456789abcdef" for c in paper_id):
            # sha256 paper_id：URL 入库论文，走 document_store 缓存
            store = DocumentStore()
            if store.exists(paper_id):
                chunks = [{"page": c.page, "chunk_id": c.chunk_id, "text": c.text}
                          for c in store.load_chunks(paper_id)]
                source = "document_store"
        if not chunks:
            parsed = parse_pdf(paper_id, pdf_dir=DATA_DIR / "pdfs")
            chunks = parsed.get("chunks", [])
            source = parsed.get("source")
        evidence = hybrid_retrieve(chunks, question, limit)
        return {
            "paper_id": paper_id,
            "query": question,
            "source": source,
            "chunk_count": len(chunks),
            "evidence": evidence,
        }

    @staticmethod
    def _pdf_ingest(url: str) -> dict:
        """安全下载 PDF 并缓存（SSRF/大小/头校验）。"""
        from research_assistant.tools.evidence import DocumentStore, download_pdf  # noqa: PLC0415

        pdf_bytes, resolved_url = download_pdf(url)
        metadata, cache_hit = DocumentStore().ingest_pdf(
            pdf_bytes, filename=resolved_url.rsplit("/", 1)[-1] or "paper.pdf", resolved_pdf_url=resolved_url
        )
        return {"metadata": metadata, "cache_hit": cache_hit}


# 全局工具单例，由 Supervisor 统一调度
tools = ToolRegistry()
