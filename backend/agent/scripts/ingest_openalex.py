"""从 OpenAlex 拉取论文元数据（含引用关系）入库 SQLite。

仅拉元数据，不下载 PDF。字段映射见 research_assistant.tools.data_source.normalize_openalex。

用法：
    python scripts/ingest_openalex.py                       # 默认 query='large language model', limit=100
    python scripts/ingest_openalex.py --query "transformer" --limit 50 --keep
"""
from __future__ import annotations

import argparse
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

AGENT_DIR = Path(__file__).resolve().parents[1]
if str(AGENT_DIR) not in sys.path:
    sys.path.insert(0, str(AGENT_DIR))

from research_assistant.tools.data_source import DATA_DIR, normalize_openalex  # noqa: E402
from research_assistant.tools.store import PaperStore  # noqa: E402

OPENALEX_API = "https://api.openalex.org/works"
SELECT_FIELDS = (
    "id,display_name,publication_year,authorships,primary_location,cited_by_count,"
    "referenced_works,abstract_inverted_index,doi,concepts"
)


def fetch_works(query: str, limit: int, mailto: str, year_from: int | None = None) -> list[dict]:
    works: list[dict] = []
    cursor = "*"
    per_page = min(limit, 200)
    while len(works) < limit and cursor:
        params = {
            "search": query,
            "per-page": per_page,
            "select": SELECT_FIELDS,
            "mailto": mailto,
            "cursor": cursor,
        }
        if year_from:
            params["filter"] = f"from_publication_date:{year_from}-01-01"
        url = f"{OPENALEX_API}?{urllib.parse.urlencode(params)}"
        with urllib.request.urlopen(url, timeout=60) as resp:
            data = resp.read().decode("utf-8")
        import json  # noqa: PLC0415

        body = json.loads(data)
        works.extend(body.get("results") or [])
        cursor = (body.get("meta") or {}).get("next_cursor")
        time.sleep(0.15)  # 限速（polite pool）
    return works[:limit]


def main() -> None:
    parser = argparse.ArgumentParser(description="OpenAlex 论文元数据入库")
    parser.add_argument("--query", default="large language model", help="检索主题")
    parser.add_argument("--limit", type=int, default=100, help="论文数量上限")
    parser.add_argument("--mailto", default="research@example.com", help="OpenAlex polite pool 邮箱")
    parser.add_argument("--year-from", type=int, default=None, help="发表年份下限")
    parser.add_argument("--db", default=str(DATA_DIR / "research.sqlite"), help="SQLite 路径")
    parser.add_argument("--keep", action="store_true", help="不清空 papers 表（默认清空重灌）")
    args = parser.parse_args()

    print(f"拉取 OpenAlex: query='{args.query}', limit={args.limit}, year_from={args.year_from} ...")
    raw = fetch_works(args.query, args.limit, args.mailto, args.year_from)
    papers = [normalize_openalex(w) for w in raw]
    papers = [p for p in papers if p["paper_id"] and p["title"]]
    print(f"命中并归一化 {len(papers)} 篇（有效 {len([p for p in papers if p['abstract']])} 篇含摘要）")

    if not args.keep:
        import sqlite3  # noqa: PLC0415

        conn = sqlite3.connect(args.db)
        try:
            conn.execute("DELETE FROM papers")
            conn.commit()
        finally:
            conn.close()
        print("已清空 papers 表")

    store = PaperStore(args.db, papers, [])
    store.close()
    print(f"已写入 SQLite: {args.db}（共 {len(papers)} 篇）")
    print("接下来把 TOOL_DATA_SOURCE=sqlite 即可让 agent 使用真实数据。")


if __name__ == "__main__":
    main()
