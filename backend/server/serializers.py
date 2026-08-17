"""后端 → 前端契约序列化（前端优先）。

原则：真实数据字段在后端对齐成前端命名/类型；纯视觉/派生字段（颜色、徽章配色、
头像色、labelLines、倒计时 offsetMs 等）由前端从数据字段推导，后端不产出。

serialize_paper 同时兼容两种输入：
  - server mock 论文（id / authors / citations 字符串 / keywords）
  - agent 内部契约（paper_id / author / citation_count / keywords / institute）
"""
from __future__ import annotations


def _to_int(v) -> int:
    """把 '98,700+' / '849k' / '1.1M' / 123 统一成 int。"""
    if isinstance(v, bool):
        return int(v)
    if isinstance(v, (int, float)):
        return int(v)
    s = str(v or "").strip().replace(",", "").replace("+", "")
    if not s:
        return 0
    mult = 1
    tail = s[-1].lower()
    if tail == "k":
        mult, s = 1000, s[:-1]
    elif tail == "m":
        mult, s = 1_000_000, s[:-1]
    try:
        return int(float(s) * mult)
    except ValueError:
        return 0


def _split_authors(authors) -> list[str]:
    """显示用作者串 → 数组（尽力拆分，供详情页 author_list 使用）。"""
    s = (authors or "").strip()
    if not s:
        return []
    if "·" in s:
        return [x.strip() for x in s.split("·") if x.strip()]
    if "," in s:
        return [x.strip() for x in s.split(",") if x.strip()]
    return [s]


def serialize_paper(p: dict) -> dict:
    """输出前端对齐的论文结构（数据字段）。"""
    pid = p.get("id") or p.get("paper_id") or ""
    authors = p.get("authors") or p.get("author") or ""
    tags = p.get("tags") or p.get("keywords") or []
    year = p.get("year") or 0
    year = int(year) if year else None
    date = p.get("date") or (f"{year}-01-01" if year else None)
    relevance = p.get("relevance")
    if relevance is None:
        relevance = p.get("relevance_score")
    if isinstance(relevance, (int, float)):
        relevance = round(float(relevance), 4)
    return {
        "id": pid,
        "title": p.get("title") or "",
        "authors": authors,
        "author_list": _split_authors(authors),
        "affiliation": p.get("affiliation") or p.get("institute"),
        "venue": p.get("venue") or "",
        "ccf": p.get("ccf"),
        "year": year,
        "date": date,
        "abstract": p.get("abstract") or "",
        "tags": list(tags),
        "citations": _to_int(p.get("citations") or p.get("citation_count") or 0),
        "doi": p.get("doi"),
        "relevance": relevance,
    }


def serialize_venue(v: dict) -> dict:
    """输出前端对齐的期刊/会议结构（数据字段）。badges/chips/metaRows/accent 由前端从 ccf/domain/rate/urgent 推导。"""
    full_name = v.get("fullName") or v.get("full_name") or ""
    kind = v.get("kind")
    if not kind:
        kind = (
            "journal"
            if any(t in full_name for t in ("Transactions", "Journal", "Review"))
            else "conference"
        )
    return {
        "id": v.get("id") or v.get("venue_id") or "",
        "abbr": v.get("abbr") or v.get("name") or "",
        "kind": kind,
        "fullName": full_name,
        "ccf": v.get("ccf"),
        "deadline": v.get("deadline"),
        "deadlineLabel": v.get("deadlineLabel") or v.get("deadline_label"),
        "urgent": bool(v.get("urgent")),
        "rate": v.get("rate"),
        "submissions": v.get("submissions"),
        "domain": v.get("domain"),
        "location": v.get("location"),
        "matchPct": v.get("matchPct") or v.get("match_pct"),
        "matchClass": v.get("matchClass"),
        "matchReason": v.get("matchReason"),
    }


def serialize_library_item(lp: dict) -> dict:
    """输出前端对齐的文献库条目。id = 论文 id（可跳详情），recordId = 文献库记录 id。"""
    return {
        "id": lp.get("pid") or lp.get("id") or "",
        "recordId": lp.get("id") or "",
        "title": lp.get("title") or "",
        "venue": lp.get("venue") or "",
        "authors": lp.get("authors") or "",
        "ccf": lp.get("ccf"),
        "arxiv": lp.get("arxiv"),
        "addedAt": lp.get("addedAt") or lp.get("collected") or "",
        "status": lp.get("status"),
        "readingProgress": lp.get("readingProgress"),
        "tags": lp.get("tags") or [],
        "folder": lp.get("folder"),
    }
