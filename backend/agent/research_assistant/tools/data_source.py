"""数据源适配层：统一加载/规范化论文与会议数据，并为真实后端留出插口。

当前数据源（mock）：
- ServerMockSource：读取 server/data/mock_data.py（默认，字段最全：keywords/doi/year/trend）
- JsonSource：读取 server/data/papers.json（备用）
- 硬编码兜底：极简论文集（保底）

统一输出「内部契约」论文 dict，并：
- 按 OpenAlex referenced_works 结构（论文 ID 列表）为论文补 references 引用关系
- 初始化 SQLite 论文/会议库（store）、向量索引（vector）、图谱（graph）

将来接真实数据（OpenAlex/SQLite/Neo4j）时，只需新增一个实现同一接口的 Source，
agents / supervisor / 前端无需改动。
"""
from __future__ import annotations

import json
import os
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[3]
# 后端数据统一目录：papers.json / pdfs / embeddings.json / papers 缓存 / research.sqlite 均位于此
# 容器部署时用 TOOL_DATA_DIR 指向 volume 挂载目录（默认仓库内 server/data），
# 避免把宿主机数据目录挂到 /app/server/data 上遮蔽 Python 包（mock_data.py 等）。
DATA_DIR = Path(os.getenv("TOOL_DATA_DIR") or (PROJECT_ROOT / "server" / "data"))

# 论文 id -> arXiv id（与 scripts/download_pdfs.py 保持一致）
ARXIV_ID = {
    "p1": "1706.03762", "p2": "1810.04805", "p3": "2005.14165", "p4": "2009.06732",
    "p5": "1704.01212", "p7": "2203.02155", "p10": "2111.07759", "p11": "2103.14030",
}

# 论文 id -> 引用关系（OpenAlex referenced_works 结构：论文 ID 列表）。
# 在 mock 数据上补充真实引用关系，供 graph_expand / 证据链使用。
REFERENCES: dict[str, list[str]] = {
    "p1": [],                      # Attention Is All You Need（根论文）
    "p2": ["p1"],                  # BERT 引 Attention
    "p3": ["p1", "p2"],            # GPT-3 引 BERT/Attention
    "p4": ["p1", "p2", "p3"],      # Efficient Transformers 综述
    "p5": [],                      # GNN for Drug Discovery（独立方向）
    "p6": ["p11"],                 # 对比学习综述 -> Swin（同 vision 领域）
    "p7": ["p1", "p2", "p3"],      # InstructGPT/RLHF
    "p8": ["p1", "p11"],           # 医学图像融合 -> Transformer/Swin
    "p9": [],                      # 联邦学习综述
    "p10": [],                     # AlphaFold2
    "p11": ["p1"],                 # Swin -> Transformer
}

# 兜底极简数据（若所有数据源加载失败）
FALLBACK_PAPERS: list[dict[str, Any]] = [
    {"id": "p1", "title": "Attention Is All You Need", "authors": "Vaswani et al.",
     "venue": "NeurIPS 2017", "ccf": "A", "match": "perfect", "abstract": "Transformer 架构。",
     "citations": "98,700+", "heat": "Hot", "year": 2017},
    {"id": "p2", "title": "BERT: Pre-training of Deep Bidirectional Transformers", "authors": "Devlin et al.",
     "venue": "NAACL 2019", "ccf": "A", "match": "perfect", "abstract": "深度双向预训练语言模型。",
     "citations": "65,200+", "heat": "Hot", "year": 2019},
]


# --------------------------------------------------------------------------- #
# 规范化工具函数
# --------------------------------------------------------------------------- #
def _parse_citations(raw: str) -> int:
    if isinstance(raw, int):
        return raw
    try:
        return int(str(raw).replace(",", "").replace("+", "").strip())
    except ValueError:
        return 0


def _parse_year(venue: str, fallback: int = 2017) -> int:
    for tok in str(venue).split():
        if tok.isdigit() and 1900 <= int(tok) <= 2100:
            return int(tok)
    return fallback


def _venue_name(venue: str) -> str:
    parts = str(venue).split()
    digits = [t for t in parts if t.isdigit()]
    return " ".join(p for p in parts if p not in digits).strip() or venue


def normalize_paper(p: dict) -> dict:
    return {
        "paper_id": p["id"],
        "title": p["title"],
        "author": p.get("authors", p.get("author", "")),
        "year": int(p.get("year") or _parse_year(p.get("venue", ""))),
        "venue": _venue_name(p.get("venue", "")),
        "ccf": p.get("ccf"),
        "citation_count": _parse_citations(p.get("citations", 0)),
        "abstract": p.get("abstract", ""),
        "keywords": p.get("keywords", []),
        "heat": p.get("heat"),
        "match_label": p.get("match", "partial"),
        "doi": p.get("doi"),
        "trend": p.get("trend"),
        "institute": p.get("institute"),
        "arxiv_id": ARXIV_ID.get(p["id"]),
        "references": REFERENCES.get(p["id"], []),
    }


def normalize_venue(v: dict) -> dict:
    return {
        "venue_id": v.get("id", v.get("name")),
        "name": v.get("name"),
        "ccf": v.get("ccf"),
        "full_name": v.get("fullName", v.get("full_name")),
        "deadline": v.get("deadline"),
        "rate": v.get("rate"),
        "match_pct": v.get("matchPct", v.get("match_pct", 0)),
        "domain": v.get("domain"),
        "location": v.get("location"),
    }


def _abstract_from_inverted(index: dict | None) -> str:
    """OpenAlex abstract_inverted_index -> 摘要文本。"""
    if not index:
        return ""
    positions: dict[int, str] = {}
    for word, idxs in index.items():
        for i in idxs:
            positions[i] = word
    return " ".join(positions[i] for i in sorted(positions))


def _openalex_id(url: str | None) -> str | None:
    """'https://openalex.org/W123' -> 'W123'；无则 None。"""
    if not url:
        return None
    return url.rstrip("/").split("/")[-1]


def normalize_openalex(work: dict) -> dict:
    """OpenAlex work -> 内部契约论文 dict（与 normalize_paper 同构）。"""
    authors = work.get("authorships") or []
    author_names = [a.get("author", {}).get("display_name", "") for a in authors if a.get("author")]
    author = author_names[0] + (" et al." if len(author_names) > 1 else "") if author_names else ""
    insts = (authors[0].get("institutions") or []) if authors else []
    primary = work.get("primary_location") or {}
    source = primary.get("source") or {}
    concepts = work.get("concepts") or []
    keywords = [c.get("display_name", "") for c in concepts[:3] if c.get("display_name")]

    return {
        "paper_id": _openalex_id(work.get("id")) or "",
        "title": work.get("display_name", ""),
        "author": author,
        "year": int(work.get("publication_year") or 0),
        "venue": source.get("display_name"),
        "ccf": None,
        "citation_count": int(work.get("cited_by_count") or 0),
        "abstract": _abstract_from_inverted(work.get("abstract_inverted_index")),
        "keywords": keywords,
        "heat": None,
        "match_label": None,
        "doi": (work.get("doi") or "").replace("https://doi.org/", ""),
        "institute": insts[0].get("display_name") if insts else None,
        "arxiv_id": None,
        "references": [_openalex_id(r) or "" for r in (work.get("referenced_works") or []) if r],
    }


# --------------------------------------------------------------------------- #
# 数据源实现（都返回规范化后的 papers / venues）
# --------------------------------------------------------------------------- #
class ServerMockSource:
    name = "server_mock"

    def load(self) -> tuple[list[dict], list[dict]]:
        if str(PROJECT_ROOT) not in sys.path:
            sys.path.insert(0, str(PROJECT_ROOT))
        from server.data.mock_data import PAPERS, JOURNALS  # noqa: PLC0415

        papers = [normalize_paper(p) for p in PAPERS]
        venues = [normalize_venue(v) for v in JOURNALS]
        return papers, venues


class JsonSource:
    name = "json"

    def __init__(self, path: str | Path | None = None) -> None:
        self.path = Path(path) if path else (DATA_DIR / "papers.json")

    def load(self) -> tuple[list[dict], list[dict]]:
        if not self.path.exists():
            raise FileNotFoundError(f"数据文件不存在: {self.path}")
        data = json.loads(self.path.read_text(encoding="utf-8"))
        papers = [normalize_paper(p) for p in data.get("papers", [])]
        venues = [normalize_venue(v) for v in data.get("journals", [])]
        return papers, venues


class SqliteSource:
    """从 SQLite（server/data/research.sqlite）读取已入库论文；库为空则抛错触发回退。"""

    name = "sqlite"

    def __init__(self, path: str | Path | None = None) -> None:
        from research_assistant.config import settings  # noqa: PLC0415

        self.path = Path(path) if path else (Path(settings.sqlite_path) if settings.sqlite_path else DATA_DIR / "research.sqlite")

    def load(self) -> tuple[list[dict], list[dict]]:
        from research_assistant.tools.store import PaperStore  # noqa: PLC0415

        papers, _ = PaperStore.load(str(self.path))
        if not papers:
            raise FileNotFoundError(f"SQLite 库无论文数据: {self.path}")
        return papers, []


@dataclass
class Backend:
    """组装好的数据后端：论文/会议数据 + store/vector/graph 索引。"""
    papers: list[dict]
    venues: list[dict]
    store: Any
    vector: Any
    graph: Any
    _meta: dict = field(default_factory=dict)

    def get_paper(self, paper_id: str) -> dict | None:
        for p in self.papers:
            if p["paper_id"] == paper_id:
                return p
        return None

    def hybrid_search(self, query: str, top_k: int = 10) -> list[dict]:
        """三路加权 RRF 融合检索：稠密向量 + BM25 词法 + 图 PageRank。

        稠密抓语义、BM25 抓精确词项、图抓引用结构。权重稠密 3.0 : BM25 1.0 :
        图 0.3（语义优先，图信号仅作弱补充，避免高引用「名论文」挤掉语义相关论文）。
        每路先召回 top_k*3 扩大候选池，融合后截取 top_k。
        """
        from research_assistant.tools.vector_index import rrf_fuse  # noqa: PLC0415

        pool = max(top_k * 3, top_k)
        return rrf_fuse(
            [
                self.vector.search_dense(query, pool),
                self.vector.search_sparse(query, pool),
                self.graph.search(query, pool),
            ],
            weights=[3.0, 1.0, 0.3],
        )[:top_k]


def _make_source() -> ServerMockSource | JsonSource | SqliteSource:
    from research_assistant.config import settings  # noqa: PLC0415

    mode = settings.tool_data_source
    if mode == "json":
        return JsonSource(settings.tool_data_path or None)
    if mode == "sqlite":
        return SqliteSource(settings.sqlite_path or None)
    return ServerMockSource()


def _load_venues() -> list[dict]:
    """会议库：OpenAlex 无 CCF 会议数据，始终取 server mock / json 的期刊库。"""
    for src in (ServerMockSource(), JsonSource()):
        try:
            _, venues = src.load()
            if venues:
                return venues
        except Exception:
            continue
    return []


def _load_source() -> tuple[list[dict], list[dict]]:
    """按配置加载数据源；失败时回退到另一数据源，再兜底极简数据。"""
    source = _make_source()
    papers: list[dict] = []
    try:
        papers, _ = source.load()
    except Exception:
        papers = []

    if not papers:
        for alt in (ServerMockSource(), JsonSource(), SqliteSource()):
            if alt.name == source.name:
                continue
            try:
                papers, _ = alt.load()
                if papers:
                    break
            except Exception:
                continue

    if not papers:
        papers = [normalize_paper(p) for p in FALLBACK_PAPERS]
    return papers, _load_venues()


def _merge_mock_papers(papers: list[dict]) -> list[dict]:
    """把演示论文（Attention/BERT/GPT-3 等基础论文）合并进检索语料。

    sqlite/json 源只含 OpenAlex 真实论文，不含这些基础论文；合并后检索才能命中
    （它们已有 PDF 与结构化分析，paper_id 为 p1..p11，与 W* 不冲突）。
    """
    try:
        mock_papers, _ = ServerMockSource().load()
    except Exception:
        return papers
    existing = {p["paper_id"] for p in papers}
    merged = list(papers)
    for p in mock_papers:
        if p["paper_id"] not in existing:
            merged.append(p)
    return merged


def build_backend():
    """按配置加载数据源，初始化 store/vector/graph 三层索引，返回 Backend 单例。"""
    papers, venues = _load_source()
    # 合并演示论文，让检索语料覆盖基础论文（Attention Is All You Need 等）
    papers = _merge_mock_papers(papers)

    from research_assistant.tools.graph_index import GraphIndex  # noqa: PLC0415
    from research_assistant.tools.store import PaperStore  # noqa: PLC0415
    from research_assistant.tools.vector_index import VectorIndex  # noqa: PLC0415
    from research_assistant.config import settings  # noqa: PLC0415

    source_name = _make_source().name
    # 只有 sqlite 源读写真实库；mock/json 源用内存 SQLite，避免覆盖已入库的真实数据
    if source_name == "sqlite":
        db_path = settings.sqlite_path or str(DATA_DIR / "research.sqlite")
    else:
        db_path = ":memory:"
    store = PaperStore(db_path, papers, venues)

    vector = VectorIndex(papers, model=settings.embedding_model)
    graph = GraphIndex(papers)

    return Backend(
        papers=papers,
        venues=venues,
        store=store,
        vector=vector,
        graph=graph,
        _meta={"source": source_name, "papers": len(papers), "venues": len(venues)},
    )


# 全局后端单例
backend = build_backend()
