"""联网检索：通过 OpenCode 同款 MCP endpoint 获取互联网搜索结果（移植自 SZDR paperreport）。

支持 provider：
- exa：`https://mcp.exa.ai/mcp`，工具名 `web_search_exa`（免 API key）
- parallel：`https://search.parallel.ai/mcp`，工具名 `web_search`（可选 PARALLEL_API_KEY）

失败时静默降级返回空列表，不影响本地检索链路。
"""
from __future__ import annotations

import json
import logging
import os
import re
from typing import Any

import httpx

log = logging.getLogger(__name__)

_EXA_URL = "https://mcp.exa.ai/mcp"
_PARALLEL_URL = "https://search.parallel.ai/mcp"

_INVALID_TITLES = {"", "n/a", "na", "-", "none", "null", "nan", "unknown"}
_YEAR_RE = re.compile(r"\b(19|20)\d{2}\b")


def _post(url: str, payload: dict[str, Any], headers: dict[str, str] | None = None,
          timeout: float = 25.0) -> dict[str, Any] | None:
    """发送 MCP JSON-RPC 请求并解析响应（兼容 SSE 与纯 JSON 两种返回）。"""
    base_headers = {
        "Accept": "application/json, text/event-stream",
        "Content-Type": "application/json",
    }
    if headers:
        base_headers.update(headers)
    try:
        resp = httpx.post(url, json=payload, headers=base_headers, timeout=timeout)
        resp.raise_for_status()
    except Exception as exc:
        log.warning("web_search 请求失败（url=%s）：%s", url, exc)
        return None

    text = resp.text.strip()
    if not text:
        return None

    # SSE 格式：逐行取首个 "data: " 载荷
    for line in text.splitlines():
        if not line.startswith("data: "):
            continue
        try:
            return json.loads(line[6:].strip())
        except json.JSONDecodeError:
            continue

    # 纯 JSON fallback
    try:
        return json.loads(text)
    except (json.JSONDecodeError, TypeError):
        return None


def _clean_year(value: Any) -> str:
    """从日期字符串中提取四位年份；无年份或为占位值时返回空串。"""
    s = str(value or "").strip()
    if not s or s.lower() in _INVALID_TITLES:
        return ""
    m = _YEAR_RE.search(s)
    return m.group(0) if m else ""


def _clean_title(title: Any) -> str:
    """清洗标题：Exa/Parallel 偶发返回 'N/A' 等占位值，一律置空。"""
    t = str(title or "").strip()
    return "" if t.lower() in _INVALID_TITLES else t


def _clean_results(results: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """过滤无标题且无 URL 的结果，标题/年份仅剩占位值时置空。"""
    cleaned: list[dict[str, Any]] = []
    for r in results:
        title = _clean_title(r.get("title"))
        url = (r.get("url") or "").strip()
        if not title and not url:
            continue
        r["title"] = title
        year = str(r.get("year") or "").strip()
        r["year"] = "" if year.lower() in _INVALID_TITLES else year
        cleaned.append(r)
    return cleaned


def _normalize_exa(data: dict[str, Any]) -> list[dict[str, Any]]:
    items = (((data.get("result") or {}).get("content")) or [])
    out: list[dict[str, Any]] = []
    for item in items:
        if not isinstance(item, dict) or item.get("type") != "text" or not item.get("text"):
            continue
        text = item["text"]
        # Exa MCP 可能返回 "Title:" 行式文本块而非 JSON
        if text.strip().startswith("Title:"):
            out.extend(_parse_exa_text_block(text))
            continue
        try:
            parsed = json.loads(text)
        except (json.JSONDecodeError, TypeError):
            continue
        for r in parsed.get("results", [])[:10]:
            out.append(
                {
                    "title": r.get("title") or "",
                    "snippet": r.get("text") or r.get("summary") or "",
                    "url": r.get("url") or r.get("link") or "",
                    "year": _clean_year(r.get("publishedDate") or r.get("year")),
                }
            )
    return _clean_results(out)


def _parse_exa_text_block(text: str) -> list[dict[str, Any]]:
    """解析 Exa MCP 纯文本结果块；一个文本块内可含多条结果（以 Title: 分隔）。

    Highlights 区只收集有信息量的行（跳过 markdown 标题与 '...' 分隔符），
    摘要过长时截断，避免占满下游 LLM 上下文。
    """
    out: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None
    snippet_parts: list[str] = []
    in_highlights = False

    def flush() -> None:
        nonlocal current, snippet_parts, in_highlights
        if current is None:
            return
        snippet = " ".join(snippet_parts).strip()
        current["snippet"] = (snippet or current["title"])[:1500]
        out.append(current)
        current = None
        snippet_parts = []
        in_highlights = False

    for line in text.splitlines():
        if line.startswith("Title:"):
            flush()
            current = {"title": line[len("Title:"):].strip(), "snippet": "", "url": "", "year": ""}
        elif current is None:
            continue
        elif line.startswith("URL:"):
            current["url"] = line[len("URL:"):].strip()
        elif line.startswith("Published:"):
            current["year"] = _clean_year(line[len("Published:"):].strip())
        elif line.startswith("Highlights:"):
            in_highlights = True
        elif in_highlights:
            stripped = line.strip()
            if not stripped or stripped == "..." or stripped.startswith("#"):
                continue
            snippet_parts.append(stripped)
    flush()
    return out


def _normalize_parallel(data: dict[str, Any]) -> list[dict[str, Any]]:
    items = (((data.get("result") or {}).get("content")) or [])
    out: list[dict[str, Any]] = []
    for item in items:
        if not isinstance(item, dict) or item.get("type") != "text" or not item.get("text"):
            continue
        try:
            parsed = json.loads(item["text"])
        except (json.JSONDecodeError, TypeError):
            continue
        for r in parsed.get("results", [])[:10]:
            # Parallel 返回 excerpts 数组 + publish_date，字段名与 Exa 不同
            excerpts = r.get("excerpts") or []
            snippet = " ".join(e for e in excerpts if isinstance(e, str))
            if not snippet:
                snippet = r.get("snippet") or r.get("description") or r.get("text") or ""
            out.append(
                {
                    "title": r.get("title") or "",
                    "snippet": snippet,
                    "url": r.get("url") or r.get("link") or "",
                    "year": _clean_year(r.get("publish_date") or r.get("publishedDate") or r.get("year")),
                }
            )
    return _clean_results(out)


def _call_exa(query: str, top_k: int, timeout: float) -> list[dict[str, Any]]:
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {
            "name": "web_search_exa",
            "arguments": {
                "query": query,
                "type": "auto",
                "numResults": max(1, min(top_k, 10)),
                "livecrawl": "fallback",
            },
        },
    }
    data = _post(_EXA_URL, payload, timeout=timeout)
    return _normalize_exa(data) if data else []


def _call_parallel(query: str, top_k: int, timeout: float) -> list[dict[str, Any]]:
    headers = {"User-Agent": "SciNexus/1.0"}
    api_key = os.getenv("PARALLEL_API_KEY")
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {
            "name": "web_search",
            "arguments": {
                "objective": query,
                "search_queries": [query],
            },
        },
    }
    data = _post(_PARALLEL_URL, payload, headers=headers, timeout=timeout)
    return _normalize_parallel(data) if data else []


def search(query: str, top_k: int = 0) -> list[dict[str, Any]]:
    """入口：执行联网检索，返回结构化结果列表。

    每个结果包含：title / snippet / url / year。
    provider 关闭、配置未知或调用失败时返回空列表，不抛错。
    """
    from research_assistant.config import settings  # noqa: PLC0415

    provider = (settings.web_search_provider or "").strip().lower()
    if provider in {"", "off", "none", "false", "0"}:
        return []
    # 只接受 exa / parallel，避免未知 provider 静默失败
    if provider not in {"exa", "parallel"}:
        log.info("web_search provider 不支持：%s，跳过联网检索。", provider)
        return []

    top_k = max(1, int(top_k or settings.web_search_top_k or 8))
    log.info("web_search 开始：provider=%s, query=%s, top_k=%d", provider, query, top_k)

    if provider == "exa":
        results = _call_exa(query, top_k, settings.web_search_timeout)
    else:
        results = _call_parallel(query, top_k, settings.web_search_timeout)

    log.info("web_search 完成：provider=%s, 返回 %d 条结果", provider, len(results))
    return results[:top_k]
