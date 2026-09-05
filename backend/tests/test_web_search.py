"""web_search（联网检索，Exa/Parallel MCP）单元测试：不发起真实网络请求。"""
from __future__ import annotations

import json
import sys
import unittest.mock as mock
from pathlib import Path

import pytest

AGENT_DIR = Path(__file__).resolve().parents[1] / "agent"
if str(AGENT_DIR) not in sys.path:
    sys.path.insert(0, str(AGENT_DIR))

from research_assistant.tools import web_search
from research_assistant.tools import tools


class _FakeHTTPResponse:
    """模拟 httpx.Response（仅 text + raise_for_status）。"""

    def __init__(self, text: str) -> None:
        self.text = text

    def raise_for_status(self) -> None:
        return None


def _sse(payload: dict) -> str:
    return f"event: message\ndata: {json.dumps(payload)}\n\n"


# --------------------------------------------------------------------------- #
# 归一化：Exa JSON 格式
# --------------------------------------------------------------------------- #
def test_normalize_exa_json_results():
    text = json.dumps({
        "results": [
            {"title": "Diffusion Policy", "text": "snippet A", "url": "https://a.com",
             "publishedDate": "2024-05-01"},
            {"title": "N/A", "link": "https://b.com", "publishedDate": "unknown"},
        ]
    })
    data = {"result": {"content": [{"type": "text", "text": text}]}}
    results = web_search._normalize_exa(data)
    assert results[0] == {"title": "Diffusion Policy", "snippet": "snippet A",
                          "url": "https://a.com", "year": "2024"}
    # 占位标题被清洗为空串，但 URL 仍在（结果保留）
    assert results[1]["title"] == ""
    assert results[1]["url"] == "https://b.com"
    assert results[1]["year"] == ""


def test_normalize_exa_ignores_non_text_items():
    data = {"result": {"content": [{"type": "image", "data": "xx"}]}}
    assert web_search._normalize_exa(data) == []


# --------------------------------------------------------------------------- #
# 归一化：Exa "Title:" 行式文本块
# --------------------------------------------------------------------------- #
def test_normalize_exa_text_block():
    text = (
        "Title: Paper One\n"
        "URL: https://x.com/one\n"
        "Published: 2023-03-01\n"
        "Highlights:\n"
        "# heading skipped\n"
        "...\n"
        "key finding line\n"
        "second line\n"
        "\n"
        "Title: Paper Two\n"
        "URL: https://x.com/two\n"
    )
    data = {"result": {"content": [{"type": "text", "text": text}]}}
    results = web_search._normalize_exa(data)
    assert len(results) == 2
    assert results[0]["title"] == "Paper One"
    assert results[0]["url"] == "https://x.com/one"
    assert results[0]["year"] == "2023"
    assert "key finding line" in results[0]["snippet"]
    assert "#" not in results[0]["snippet"]
    assert results[1]["snippet"] == "Paper Two"  # 无摘要时以标题兜底


# --------------------------------------------------------------------------- #
# 归一化：Parallel excerpts 格式
# --------------------------------------------------------------------------- #
def test_normalize_parallel_excerpts():
    text = json.dumps({
        "results": [
            {"title": "Parallel Result", "excerpts": ["ex1", "ex2"],
             "url": "https://p.com", "publish_date": "2022-11-30"},
        ]
    })
    data = {"result": {"content": [{"type": "text", "text": text}]}}
    results = web_search._normalize_parallel(data)
    assert results[0] == {"title": "Parallel Result", "snippet": "ex1 ex2",
                          "url": "https://p.com", "year": "2022"}


# --------------------------------------------------------------------------- #
# _post：SSE 与纯 JSON 双解析
# --------------------------------------------------------------------------- #
def test_post_parses_sse_payload():
    payload = {"result": {"content": []}}
    fake = _FakeHTTPResponse(_sse(payload) + _sse({"other": 1}))
    with mock.patch.object(web_search.httpx, "post", return_value=fake) as post:
        data = web_search._post("https://mcp.exa.ai/mcp", {"jsonrpc": "2.0"})
    assert data == payload
    assert post.call_args.kwargs["timeout"] == 25.0


def test_post_parses_plain_json_and_swallows_errors():
    payload = {"ok": 1}
    with mock.patch.object(web_search.httpx, "post",
                           return_value=_FakeHTTPResponse(json.dumps(payload))):
        assert web_search._post("https://mcp.exa.ai/mcp", {}) == payload
    with mock.patch.object(web_search.httpx, "post", side_effect=OSError("boom")):
        assert web_search._post("https://mcp.exa.ai/mcp", {}) is None


# --------------------------------------------------------------------------- #
# search() 入口：provider 门控与 top_k
# --------------------------------------------------------------------------- #
def _exa_sse_response(n: int = 5) -> _FakeHTTPResponse:
    text = json.dumps({
        "results": [
            {"title": f"T{i}", "text": f"s{i}", "url": f"https://r.com/{i}",
             "publishedDate": "2024-01-01"}
            for i in range(n)
        ]
    })
    return _FakeHTTPResponse(_sse({"result": {"content": [{"type": "text", "text": text}]}}))


def test_search_disabled_provider_returns_empty_without_network():
    from research_assistant.config import settings

    with mock.patch.object(settings, "web_search_provider", "off"), \
            mock.patch.object(web_search.httpx, "post") as post:
        assert web_search.search("query") == []
    post.assert_not_called()


def test_search_unknown_provider_returns_empty():
    from research_assistant.config import settings

    with mock.patch.object(settings, "web_search_provider", "bing"):
        assert web_search.search("query") == []


def test_search_exa_mcp_end_to_end_with_mocked_http():
    from research_assistant.config import settings

    with mock.patch.object(settings, "web_search_provider", "exa"), \
            mock.patch.object(settings, "web_search_top_k", 3), \
            mock.patch.object(web_search.httpx, "post",
                              return_value=_exa_sse_response(5)) as post:
        results = web_search.search("diffusion robot", top_k=3)
    assert len(results) == 3
    assert results[0]["title"] == "T0"
    # 请求体为 MCP tools/call（opencode 同款 web_search_exa 工具）
    body = post.call_args.kwargs["json"]
    assert body["method"] == "tools/call"
    assert body["params"]["name"] == "web_search_exa"
    assert body["params"]["arguments"]["numResults"] == 3


# --------------------------------------------------------------------------- #
# 工具注册表集成：web_search 受 Supervisor 授权闸门约束
# --------------------------------------------------------------------------- #
def test_web_search_tool_denied_without_authorization():
    with pytest.raises(PermissionError):
        with tools.authorized_for("scout", ["vector_rag", "graph_rag"]):
            tools.call("web_search", query="x")


# --------------------------------------------------------------------------- #
# 质量过滤：标题去重 + 域名黑名单
# --------------------------------------------------------------------------- #
def test_dedupe_results_by_url_and_title():
    results = [
        {"title": "A Survey on LfD", "url": "https://a.com/1"},
        {"title": "A Survey on LfD", "url": "https://b.com/mirror"},  # 同文异站转载
        {"title": "Other Paper", "url": "https://a.com/1"},           # 同 URL 不同标题
        {"title": "", "url": "https://c.com/x"},                      # 无标题：不去重
    ]
    out = web_search._dedupe_results(results)
    assert [r["url"] for r in out] == ["https://a.com/1", "https://c.com/x"]


def test_search_filters_blocked_domains():
    from research_assistant.config import settings

    text = json.dumps({
        "results": [
            {"title": "Spam Post", "url": "https://spam-blog.example/post/1"},
            {"title": "Subdomain Also Blocked", "url": "https://news.spam-blog.example/p/2"},
            {"title": "Good Paper", "url": "https://arxiv.org/abs/1234"},
        ]
    })
    fake = _FakeHTTPResponse(_sse({"result": {"content": [{"type": "text", "text": text}]}}))
    with mock.patch.object(settings, "web_search_provider", "exa"), \
            mock.patch.object(settings, "web_search_block_domains", "spam-blog.example"), \
            mock.patch.object(web_search.httpx, "post", return_value=fake):
        results = web_search.search("query")
    assert [r["title"] for r in results] == ["Good Paper"]


# --------------------------------------------------------------------------- #
# 快速模式摘要输入选择：本地论文优先 + 联网来源带入
# --------------------------------------------------------------------------- #
def test_select_summary_papers_includes_web_tail():
    from server.agent_gateway import _select_summary_papers

    local = [{"title": f"L{i}", "source": None} for i in range(8)]
    web = [{"title": f"W{i}", "source": "web", "url": f"https://w.com/{i}"} for i in range(5)]
    selected = _select_summary_papers(local + web)
    # 本地取前 6，web 取前 3，web 排在尾部
    assert [p["title"] for p in selected] == ["L0", "L1", "L2", "L3", "L4", "L5",
                                              "W0", "W1", "W2"]
    assert all(p.get("url") for p in selected if p["source"] == "web")


def test_select_summary_papers_web_only():
    from server.agent_gateway import _select_summary_papers

    web = [{"title": f"W{i}", "source": "web"} for i in range(5)]
    assert len(_select_summary_papers(web)) == 5  # 无本地结果时 web 全部保留


def test_supervisor_grants_web_search_only_to_scout_when_enabled():
    from research_assistant.supervisor import _authorized_tools_for, forced_decision

    assert "web_search" not in _authorized_tools_for("scout", web_search_on=False)
    assert "web_search" in _authorized_tools_for("scout", web_search_on=True)
    assert "web_search" not in _authorized_tools_for("synthesis", web_search_on=True)

    plan = forced_decision("research_exploration", web_search_on=True)
    scout_steps = [s for s in plan["steps"] if s["agent"] == "scout"]
    assert scout_steps and "web_search" in scout_steps[0]["authorized_tools"]
