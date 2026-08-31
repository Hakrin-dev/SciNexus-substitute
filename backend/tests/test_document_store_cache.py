from __future__ import annotations

import json
import sys
from pathlib import Path

AGENT_DIR = Path(__file__).resolve().parents[1] / "agent"
if str(AGENT_DIR) not in sys.path:
    sys.path.insert(0, str(AGENT_DIR))

from research_assistant.tools.evidence.store import CACHE_SCHEMA_VERSION, DocumentStore


def test_document_store_reuses_a_validated_source_url(tmp_path: Path):
    store = DocumentStore(tmp_path)
    paper_id = "a" * 64
    directory = tmp_path / paper_id
    directory.mkdir()
    (directory / "metadata.json").write_text(json.dumps({
        "paper_id": paper_id,
        "cache_schema_version": CACHE_SCHEMA_VERSION,
        "source_url": "https://example.test/paper.pdf",
        "resolved_pdf_url": "https://cdn.example.test/paper.pdf",
    }), encoding="utf-8")
    (directory / "chunks.json").write_text("[]", encoding="utf-8")

    assert store.find_by_source_url("https://example.test/paper.pdf")["paper_id"] == paper_id
    assert store.find_by_source_url("https://cdn.example.test/paper.pdf")["paper_id"] == paper_id
    assert store.find_by_source_url("https://example.test/other.pdf") is None
