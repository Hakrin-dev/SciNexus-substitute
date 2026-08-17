"""PDF 缓存库：SHA-256 命名、版本号、原子写入（移植自队友架构）。

缓存位置：server/data/papers/{paper_id}/  （original.pdf / metadata.json / chunks.json / structured_summary.json）
"""
from __future__ import annotations

import hashlib
import json
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from research_assistant.tools.data_source import DATA_DIR
from research_assistant.tools.evidence.hybrid import PaperChunk, build_structured_analysis

CACHE_SCHEMA_VERSION = 2
MAX_PDF_BYTES = 30 * 1024 * 1024

DEFAULT_ROOT = DATA_DIR / "papers"


def _atomic_write(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(dir=path.parent, prefix=".tmp-", suffix="", delete=False) as temporary:
            temporary.write(content)
            temporary.flush()
            os.fsync(temporary.fileno())
            temporary_path = Path(temporary.name)
        os.replace(temporary_path, path)
    finally:
        if temporary_path is not None and temporary_path.exists():
            temporary_path.unlink()


def _atomic_write_json(path: Path, value: Any) -> None:
    _atomic_write(path, json.dumps(value, ensure_ascii=False, indent=2).encode("utf-8"))


class DocumentStore:
    def __init__(self, root: Path | None = None) -> None:
        self.root = root or DEFAULT_ROOT

    @staticmethod
    def paper_id(pdf_bytes: bytes) -> str:
        return hashlib.sha256(pdf_bytes).hexdigest()

    def paper_dir(self, paper_id: str) -> Path:
        if not paper_id or not all(c in "0123456789abcdef" for c in paper_id):
            raise ValueError("paper_id 格式无效")
        return self.root / paper_id

    def exists(self, paper_id: str) -> bool:
        directory = self.paper_dir(paper_id)
        if not (directory / "metadata.json").exists() or not (directory / "chunks.json").exists():
            return False
        try:
            metadata = json.loads((directory / "metadata.json").read_text(encoding="utf-8"))
            json.loads((directory / "chunks.json").read_text(encoding="utf-8"))
        except (OSError, ValueError, json.JSONDecodeError):
            return False
        return metadata.get("cache_schema_version") == CACHE_SCHEMA_VERSION

    def ingest_pdf(self, pdf_bytes: bytes, *, filename: str, source_url: str | None = None,
                   resolved_pdf_url: str | None = None) -> tuple[dict[str, Any], bool]:
        if not pdf_bytes.startswith(b"%PDF"):
            raise ValueError("上传内容不是有效 PDF。")
        if len(pdf_bytes) > MAX_PDF_BYTES:
            raise ValueError("PDF 超过 30 MB，当前版本暂不处理。")
        paper_id = self.paper_id(pdf_bytes)
        if self.exists(paper_id):
            metadata = self.load_metadata(paper_id)
            updates = {
                key: value
                for key, value in {"source_url": source_url, "resolved_pdf_url": resolved_pdf_url}.items()
                if value and not metadata.get(key)
            }
            if updates:
                metadata.update(updates)
                _atomic_write_json(self.paper_dir(paper_id) / "metadata.json", metadata)
            return metadata, True

        from research_assistant.tools.evidence.reader import extract_pdf_chunks  # noqa: PLC0415

        chunks, page_count = extract_pdf_chunks(pdf_bytes)
        directory = self.paper_dir(paper_id)
        directory.mkdir(parents=True, exist_ok=True)
        metadata = {
            "paper_id": paper_id,
            "cache_schema_version": CACHE_SCHEMA_VERSION,
            "filename": Path(filename).name or "paper.pdf",
            "source_url": source_url,
            "resolved_pdf_url": resolved_pdf_url,
            "page_count": page_count,
            "chunk_count": len(chunks),
            "extracted_characters": sum(len(c.text) for c in chunks),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        _atomic_write(directory / "original.pdf", pdf_bytes)
        _atomic_write_json(directory / "metadata.json", metadata)
        _atomic_write_json(
            directory / "chunks.json",
            [{"page": c.page, "chunk_id": c.chunk_id, "text": c.text} for c in chunks],
        )
        self.save_structured_analysis(paper_id, build_structured_analysis(chunks))
        return metadata, False

    def load_metadata(self, paper_id: str) -> dict[str, Any]:
        path = self.paper_dir(paper_id) / "metadata.json"
        if not path.exists():
            raise FileNotFoundError("没有找到已缓存的论文，请重新上传。")
        return json.loads(path.read_text(encoding="utf-8"))

    def load_chunks(self, paper_id: str) -> list[PaperChunk]:
        path = self.paper_dir(paper_id) / "chunks.json"
        if not path.exists():
            raise FileNotFoundError("没有找到论文文本块，请重新上传。")
        return [
            PaperChunk(page=int(item["page"]), chunk_id=item["chunk_id"], text=item["text"])
            for item in json.loads(path.read_text(encoding="utf-8"))
        ]

    def save_structured_analysis(self, paper_id: str, analysis: dict[str, Any]) -> None:
        _atomic_write_json(self.paper_dir(paper_id) / "structured_summary.json", analysis)

    def load_structured_analysis(self, paper_id: str) -> dict[str, Any]:
        path = self.paper_dir(paper_id) / "structured_summary.json"
        if not path.exists():
            chunks = self.load_chunks(paper_id)
            self.save_structured_analysis(paper_id, build_structured_analysis(chunks))
        return json.loads(path.read_text(encoding="utf-8"))
