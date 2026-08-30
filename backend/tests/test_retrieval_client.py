from __future__ import annotations

import json
import importlib.util
import sys
from pathlib import Path
from unittest.mock import patch

AGENT_DIR = Path(__file__).resolve().parents[1] / "agent"
if str(AGENT_DIR) not in sys.path:
    sys.path.insert(0, str(AGENT_DIR))

from research_assistant.integrations.retrieval_client import KnowledgeBaseClient
from research_assistant.integrations.retrieval_types import RetrievalPaper

_fusion_path = AGENT_DIR / "research_assistant" / "tools" / "result_fusion.py"
_fusion_spec = importlib.util.spec_from_file_location("retrieval_result_fusion", _fusion_path)
assert _fusion_spec and _fusion_spec.loader
_fusion_module = importlib.util.module_from_spec(_fusion_spec)
_fusion_spec.loader.exec_module(_fusion_module)
fuse_results = _fusion_module.fuse_results


class _Response:
    def __init__(self, payload: dict) -> None:
        self.payload = payload

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self) -> bytes:
        return json.dumps(self.payload).encode("utf-8")


def test_retrieval_paper_normalizes_remote_fields():
    paper = RetrievalPaper.from_api({
        "paper_id": "paper:1",
        "title": "Graph Research",
        "conference": "AAAI",
        "year": 2024,
        "authors": [{"name": "Alice"}, "Bob"],
        "score": 0.022,
        "rank": 1,
    })
    internal = paper.to_agent()
    assert internal["paper_id"] == "paper:1"
    assert internal["author"] == "Alice, Bob"
    assert internal["venue"] == "AAAI"
    assert internal["relevance_score"] == 0.022
    assert internal["db_source"] == "remote_knowledge_base"


def test_search_sends_filters_and_normalizes_results():
    captured = {}

    def fake_open(request, timeout):
        captured["body"] = json.loads(request.data.decode("utf-8"))
        captured["timeout"] = timeout
        return _Response({
            "results": [{"paper_id": "paper:2", "title": "A Paper", "conference": "CVPR", "rank": 1}],
            "query_parse": {"language": "en"},
        })

    client = KnowledgeBaseClient("http://knowledge.test", timeout=3, retries=0)
    with patch("research_assistant.integrations.retrieval_client.urlopen", fake_open):
        result = client.search("vision", top_k=5, year_gte=2022, conference=["CVPR"])

    assert captured["body"]["top_k"] == 5
    assert captured["body"]["year_gte"] == 2022
    assert captured["body"]["conference"] == ["CVPR"]
    assert captured["timeout"] == 3
    assert result["results"][0].paper_id == "paper:2"
    assert result["query_parse"] == {"language": "en"}


def test_hybrid_fusion_deduplicates_and_keeps_source_trace():
    remote = [{"paper_id": "p1", "title": "Remote", "db_source": "remote_knowledge_base"}]
    local = [
        {"paper_id": "p2", "title": "Local", "db_source": "local"},
        {"paper_id": "p1", "title": "Duplicate", "db_source": "local"},
    ]
    fused = fuse_results([remote, local], weights=[1.0, 0.7], top_k=10)

    assert [paper["paper_id"] for paper in fused].count("p1") == 1
    p1 = next(paper for paper in fused if paper["paper_id"] == "p1")
    assert p1["title"] == "Remote"
    assert p1["db_source"] == "remote_knowledge_base+local"
    assert p1["relevance_score"] > 0
