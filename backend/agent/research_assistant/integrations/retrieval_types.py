"""远程知识底座的稳定内部数据类型。"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


def _text(value: Any) -> str:
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, dict):
        return _text(value.get("name") or value.get("display_name") or value.get("title") or value.get("id"))
    return "" if value is None else str(value)


def _strings(value: Any) -> list[str]:
    if isinstance(value, list):
        return [text for item in value if (text := _text(item))]
    text = _text(value)
    return [text] if text else []


def _number(value: Any, *, integer: bool = False) -> int | float | None:
    try:
        return int(value) if integer else float(value)
    except (TypeError, ValueError):
        return None


@dataclass(slots=True)
class RetrievalPaper:
    paper_id: str
    title: str
    abstract: str = ""
    venue: str = ""
    year: int | None = None
    authors: list[str] = field(default_factory=list)
    keywords: list[str] = field(default_factory=list)
    subjects: list[str] = field(default_factory=list)
    score: float | None = None
    rank: int | None = None
    doi: str | None = None
    pdf_url: str | None = None

    @classmethod
    def from_api(cls, raw: dict[str, Any]) -> "RetrievalPaper":
        return cls(
            paper_id=_text(raw.get("paper_id") or raw.get("paperId") or raw.get("id")),
            title=_text(raw.get("title")) or "Untitled",
            abstract=_text(raw.get("abstract")),
            venue=_text(raw.get("venue") or raw.get("conference")),
            year=_number(raw.get("year"), integer=True),
            authors=_strings(raw.get("authors") or raw.get("author")),
            keywords=_strings(raw.get("keywords")),
            subjects=_strings(raw.get("subjects")),
            score=_number(raw.get("score")),
            rank=_number(raw.get("rank"), integer=True),
            doi=_text(raw.get("doi")) or None,
            pdf_url=_text(raw.get("pdf_url") or raw.get("pdfUrl")) or None,
        )

    def to_agent(self) -> dict[str, Any]:
        """转换为现有 Scout/data_source 使用的内部论文契约。"""
        return {
            "paper_id": self.paper_id,
            "title": self.title,
            "author": ", ".join(self.authors),
            "year": self.year or 0,
            "venue": self.venue,
            "abstract": self.abstract,
            "keywords": list(dict.fromkeys([*self.keywords, *self.subjects])),
            "subjects": list(self.subjects),
            "citation_count": 0,
            "references": [],
            "relevance_score": self.score or 0.0,
            "_score": self.score or 0.0,
            "rank": self.rank,
            "doi": self.doi,
            "pdf_url": self.pdf_url,
            "db_source": "remote_knowledge_base",
        }
