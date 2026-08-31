"""多数据源检索结果融合。"""
from __future__ import annotations

from typing import Iterable


def fuse_results(
    ranked_lists: Iterable[list[dict]],
    *,
    weights: list[float] | None = None,
    top_k: int = 10,
    rrf_k: int = 60,
) -> list[dict]:
    """用加权 RRF 按 paper_id 去重并融合多路有序结果。

    首次出现的数据记录作为字段主体，融合分写入 ``relevance_score``；原始远程
    score 保存在 ``source_score``，避免把远程排序分误当成百分比。
    """
    lists = list(ranked_lists)
    effective_weights = weights or [1.0] * len(lists)
    if len(effective_weights) != len(lists):
        raise ValueError("weights 数量必须与结果列表数量一致")

    records: dict[str, dict] = {}
    scores: dict[str, float] = {}
    sources: dict[str, list[str]] = {}
    for items, weight in zip(lists, effective_weights):
        for rank, item in enumerate(items, start=1):
            paper_id = str(item.get("paper_id") or item.get("id") or "")
            if not paper_id:
                continue
            records.setdefault(paper_id, dict(item))
            scores[paper_id] = scores.get(paper_id, 0.0) + float(weight) / (rrf_k + rank)
            source = str(item.get("db_source") or "unknown")
            if source not in sources.setdefault(paper_id, []):
                sources[paper_id].append(source)

    ordered = sorted(records, key=lambda paper_id: scores[paper_id], reverse=True)[:top_k]
    result = []
    for paper_id in ordered:
        item = records[paper_id]
        item["source_score"] = item.get("relevance_score")
        item["relevance_score"] = scores[paper_id]
        item["_score"] = scores[paper_id]
        item["db_source"] = "+".join(sources[paper_id])
        result.append(item)
    return result
