"""远程知识底座 HTTP 客户端。

该模块不依赖 FastAPI，可被 server 网关和各智能体共享。只对 500/503、超时和
网络异常做有限重试；400/404 会立即返回错误，避免无意义请求。
"""
from __future__ import annotations

import json
import socket
import time
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from research_assistant.config import settings
from research_assistant.integrations.retrieval_types import RetrievalPaper


class KnowledgeBaseError(RuntimeError):
    def __init__(self, message: str, status: int | None = None) -> None:
        super().__init__(message)
        self.status = status


class KnowledgeBaseClient:
    def __init__(
        self,
        base_url: str | None = None,
        timeout: float | None = None,
        retries: int | None = None,
    ) -> None:
        self.base_url = (base_url or settings.retrieval_api_url).rstrip("/")
        self.timeout = timeout if timeout is not None else settings.retrieval_timeout_seconds
        self.retries = retries if retries is not None else settings.retrieval_retry_count

    def _request(self, path: str, *, payload: dict[str, Any] | None = None) -> Any:
        data = json.dumps(payload).encode("utf-8") if payload is not None else None
        request = Request(
            f"{self.base_url}{path}",
            data=data,
            method="POST" if data is not None else "GET",
            headers={"Accept": "application/json", "Content-Type": "application/json"},
        )
        last_error: Exception | None = None
        for attempt in range(self.retries + 1):
            try:
                with urlopen(request, timeout=self.timeout) as response:  # noqa: S310 - configured service URL
                    return json.loads(response.read().decode("utf-8"))
            except HTTPError as exc:
                detail = exc.read().decode("utf-8", errors="replace")[:200]
                error = KnowledgeBaseError(f"知识底座请求失败 ({exc.code}): {detail}", exc.code)
                if exc.code not in (500, 503) or attempt >= self.retries:
                    raise error from exc
                last_error = error
            except (URLError, TimeoutError, socket.timeout, OSError) as exc:
                last_error = exc
                if attempt >= self.retries:
                    break
            if attempt < self.retries:
                time.sleep(min(0.2 * (2**attempt), 1.0))
        raise KnowledgeBaseError(f"知识底座暂不可用: {last_error}") from last_error

    def search(
        self,
        query: str,
        *,
        top_k: int | None = None,
        year_gte: int | None = None,
        year_lte: int | None = None,
        conference: list[str] | None = None,
        author: list[str] | None = None,
        keyword: list[str] | None = None,
        subject: list[str] | None = None,
    ) -> dict[str, Any]:
        payload = {
            "query": query,
            "top_k": max(1, min(50, top_k or settings.retrieval_default_top_k)),
            "year_gte": year_gte,
            "year_lte": year_lte,
            "conference": conference or [],
            "author": author or [],
            "keyword": keyword or [],
            "subject": subject or [],
        }
        started = time.monotonic()
        raw = self._request("/api/retrieval/search", payload=payload)
        results = [
            paper
            for item in (raw.get("results") or [])
            if (paper := RetrievalPaper.from_api(item)).paper_id
        ]
        return {
            "results": results,
            "state": raw.get("state") or {},
            "query_parse": raw.get("query_parse") or {},
            "query_rewrite": raw.get("query_rewrite") or {},
            "took_ms": round((time.monotonic() - started) * 1000),
        }

    def get_paper(self, paper_id: str) -> RetrievalPaper:
        raw = self._request(f"/api/kg/paper?{urlencode({'paperId': paper_id})}")
        paper = RetrievalPaper.from_api(raw)
        if not paper.paper_id:
            paper.paper_id = paper_id
        return paper

    def get_graph(self, paper_id: str, depth: int = 1) -> dict[str, Any]:
        query = urlencode({"paperId": paper_id, "depth": max(1, min(3, depth))})
        raw = self._request(f"/api/kg/graph?{query}")
        return {
            "rootId": raw.get("rootId") or raw.get("root_id") or paper_id,
            "nodes": raw.get("nodes") or [],
            "lines": raw.get("lines") or [],
        }

    def health(self) -> dict[str, Any]:
        return {
            "service": self._request("/api/health"),
            "retrieval": self._request("/api/retrieval/health"),
            "ready": self._request("/api/retrieval/ready"),
        }


client = KnowledgeBaseClient()
