from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import patch

AGENT_DIR = Path(__file__).resolve().parents[1] / "agent"
if str(AGENT_DIR) not in sys.path:
    sys.path.insert(0, str(AGENT_DIR))

from research_assistant.agents.synthesis import SynthesisAgent


def _state(pdf_url: str | None = None) -> dict:
    paper = {
        "paper_id": "paper:remote-1",
        "title": "Remote Evidence Paper",
        "db_source": "remote_knowledge_base",
    }
    if pdf_url:
        paper["pdf_url"] = pdf_url
    return {"working_memory": {"agent_outputs": {"scout": {"retrieved_papers": [paper]}}}}


def test_synthesis_does_not_turn_abstract_fallback_into_page_evidence():
    agent = object.__new__(SynthesisAgent)

    with patch("research_assistant.agents.synthesis.tools.call", return_value={
        "source": "abstract_fallback", "chunks": [{"page": 1, "text": "abstract"}]
    }) as call:
        evidence, provenance = agent._collect_paper_evidence(_state(), "paper:remote-1", "what is the method?")

    assert evidence == []
    assert provenance["status"] == "metadata_only"
    assert [item.args[0] for item in call.call_args_list] == ["pdf_parser"]


def test_synthesis_caches_remote_pdf_before_retrieving_page_evidence():
    agent = object.__new__(SynthesisAgent)
    document_id = "a" * 64

    def fake_call(name: str, **kwargs):
        if name == "pdf_parser":
            return {"source": "abstract_fallback", "chunks": []}
        if name == "pdf_ingest":
            assert kwargs["url"] == "https://example.test/paper.pdf"
            return {"document_id": document_id, "cache_hit": False}
        if name == "evidence_retrieve":
            assert kwargs["paper_id"] == document_id
            return {"evidence": [{"page": 2, "chunk_id": "p2-c1", "text": "verified PDF text"}]}
        raise AssertionError(name)

    with patch("research_assistant.agents.synthesis.tools.call", side_effect=fake_call):
        evidence, provenance = agent._collect_paper_evidence(
            _state("https://example.test/paper.pdf"), "paper:remote-1", "what is the method?"
        )

    assert evidence[0]["chunk_id"] == "p2-c1"
    assert provenance["source"] == "remote_pdf_cache"
    assert provenance["status"] == "fulltext"
