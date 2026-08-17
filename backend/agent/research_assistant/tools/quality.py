"""论文质量分级：设计文档的四维 checklist → Perfect/Partial/Weak 三级评估。

确定性规则、无需 LLM。与检索相关度分数（用于排序）正交：checklist 负责
给每篇论文打质量标签，相关度分数负责排序，两者各司其职。
"""
from __future__ import annotations

from datetime import datetime


def checklist_match_level(
    relevance_score: float,
    ccf: str | None,
    citation_count: int,
    year: int,
    current_year: int | None = None,
) -> str:
    """四维 checklist → 三级质量分级，返回小写 "perfect"/"partial"/"weak"。

    四维（对齐设计文档「基于 checklist 进行三级评估」）：
      1. 主题相关度（0..1 检索得分，主信号）：>=0.5 记 2 分，>=0.3 记 1 分
      2. CCF 等级：A 记 1 分（顶会/顶刊）
      3. 引用量：>=1000 记 1 分（影响力）
      4. 时效性：近 5 年记 1 分（最新进展）
    总分 >=3 → perfect；>=2 → partial；否则 weak。
    """
    if current_year is None:
        current_year = datetime.now().year

    score = 0
    if relevance_score >= 0.5:
        score += 2
    elif relevance_score >= 0.3:
        score += 1
    if (ccf or "").upper() == "A":
        score += 1
    if (citation_count or 0) >= 1000:
        score += 1
    if year and year >= current_year - 5:
        score += 1

    if score >= 3:
        return "perfect"
    if score >= 2:
        return "partial"
    return "weak"
