"""Scout Agent（信息收集）：跨数据源精准检索与排序、多路检索校验。"""
from __future__ import annotations

import logging
import re
from datetime import datetime, timezone

from research_assistant.agents.base import BaseAgent
from research_assistant.llm import LLMProvider
from research_assistant.schemas import RetrievedPaper, ScoutOutput, ScoutQueryPlan
from research_assistant.tools import tools
from research_assistant.tools.quality import checklist_match_level
from research_assistant.config import settings

logger = logging.getLogger(__name__)

# 常见中文填充词（mock 阶段代替分词）
_FILLERS = (
    "帮我", "帮我查", "帮我找", "帮我搜索", "搜索", "查找", "查询", "找", "查",
    "相关", "的", "方向", "关于", "一下", "文章", "文献", "论文", "最近",
    "研究", "领域", "近五年", "近", "年", "趋势", "发展", "进展", "请", "推荐", "看看",
)


def extract_topics(query: str) -> list[str]:
    """提取检索主题词：英文 token + 去填充词后的中文片段。"""
    terms: list[str] = []
    # 英文 token（transformer / gpt / cvpr 等）
    terms += re.findall(r"[A-Za-z][A-Za-z0-9\-]{1,}", query)
    # 中文：去掉填充词与英文后按空白切分
    q = query
    for f in _FILLERS:
        q = q.replace(f, " ")
    q = re.sub(r"[A-Za-z0-9\-]+", " ", q)
    terms += [t for t in q.split() if len(t) >= 2]
    return list(dict.fromkeys(terms))[:3]


SYSTEM_PROMPT = (
    "你是一位严谨的学术情报分析师，具备以下核心能力：\n"
    "\n"
    "【检索策略】\n"
    "1. 将模糊查询拆解为逻辑检索树：必须包含条件 AND 可选关键词 OR 排他条件 NOT\n"
    "2. 多路召回：VectorRAG（语义匹配）+ GraphRAG（关系推理）并行执行\n"
    "3. 质量过滤：基于 checklist 进行三级评估（Perfect/Partial/Weak）\n"
    "\n"
    "【输出规范】\n"
    "- 每篇论文必须提供：标题、作者、年份、机构、引用数、匹配等级、证据片段\n"
    "- 禁止推荐无关文献，宁可返回空结果也不强行匹配\n"
    "- 标注检索时间戳和数据库来源\n"
    "\n"
    "【禁止事项】\n"
    "严禁推荐未在数据库中真实存在的论文；不得忽略用户指定的时间范围限制；禁止返回与查询主题"
    "明显无关的结果；不允许跳过质量评估直接返回原始检索结果；不得泄露其他用户的隐私信息或研究内容。"
)


def _web_results_to_hits(results: list[dict]) -> list[dict]:
    """web_search 结果 -> scout 内部候选 dict（复用统一的 RetrievedPaper 映射与质量分级）。

    paper_id 用 URL（无 URL 时 web:{序号}:{标题}）；相关度按排名衰减（0.35→0.1），
    使联网来源排在本地高质量论文之后但仍然可见。
    """
    provider = (settings.web_search_provider or "exa").capitalize()
    hits: list[dict] = []
    for i, r in enumerate(results):
        title = str(r.get("title") or "").strip()
        url = str(r.get("url") or "").strip()
        if not title and not url:
            continue
        # 有 URL 无标题的结果（标题被清洗为占位值）以 URL 兜底，保证可读
        if not title:
            title = url
        hits.append({
            "paper_id": url or f"web:{i}:{title}",
            "title": title,
            "author": "",
            "year": int(r.get("year") or 0),
            "citation_count": 0,
            "_score": max(0.1, 0.35 - 0.05 * i),
            "abstract": str(r.get("snippet") or "").strip(),
            "venue": "互联网检索",
            "db_source": f"WebSearch({provider})",
            "url": url or None,
        })
    return hits


class ScoutAgent(BaseAgent):
    name = "scout"

    def __init__(self, llm: LLMProvider) -> None:
        super().__init__(llm)
        self.system_prompt = SYSTEM_PROMPT

    def run(self, state: dict) -> dict:
        query = state["user_query"]
        # 用户启用「联网搜索」时补充互联网来源（工具是否可用仍由 Supervisor 授权闸门决定）
        web_search_on = bool((state.get("context") or {}).get("web_search"))

        # 阶段1. LLM 规划（需求解析 + 查询构建）：输出检索条件、3 个粒度子查询与 checklist
        #        mock 模式回显确定性计划；真实模式由 LLM 按 schema 生成。
        def _mock_plan() -> dict:
            topics = extract_topics(query)
            if topics:
                sub = [query, topics[0], f"{topics[0]} 最新进展"]
            else:
                sub = [query, query, query]
            return {
                "core_topics": topics,
                "time_range": [2015, 2025],
                "venue_level": None,
                "domain": None,
                "author": None,
                "sub_queries": sub,
                "web_query": query,
                "checklist": [
                    "是否与查询主题高度相关？",
                    "是否发表于 CCF 推荐的顶级会议/期刊？",
                    "是否有足够的引用量支撑影响力？",
                    "是否涵盖最新的研究进展？",
                ],
            }

        available_tools = ["vector_rag", "graph_rag"] + (["web_search"] if web_search_on else [])
        plan: ScoutQueryPlan = self.generate(
            {"user_query": query, "available_tools": available_tools},
            ScoutQueryPlan,
            _mock_plan(),
        )
        filters = {
            "core_topics": list(plan.core_topics),
            "time_range": list(plan.time_range) or [2015, 2025],
            "domain": plan.domain,
            "venue": plan.venue_level,
        }

        # 阶段2. 工具执行：远程知识底座优先；local/hybrid 或远程异常时使用本地检索。
        top_k = 10
        remote_hits: list[dict] = []
        remote_error: Exception | None = None
        if settings.retrieval_provider in ("remote", "hybrid"):
            try:
                from research_assistant.integrations.retrieval_client import client

                time_range = filters.get("time_range") or []
                remote = client.search(
                    query,
                    top_k=top_k,
                    year_gte=time_range[0] if len(time_range) > 0 else None,
                    year_lte=time_range[1] if len(time_range) > 1 else None,
                    conference=[filters["venue"]] if filters.get("venue") else None,
                    subject=[filters["domain"]] if filters.get("domain") else None,
                )
                remote_hits = [paper.to_agent() for paper in remote["results"]]
            except Exception as exc:
                remote_error = exc

        vector_hits: list[dict] = []
        graph_hits: list[dict] = []
        use_local = settings.retrieval_provider in ("local", "hybrid")
        use_local = use_local or (remote_error is not None and settings.retrieval_fallback_local)
        if use_local:
            # 相关度以原始 query 为准，避免 LLM 扩写主题稀释相关度。
            vector_hits = tools.call("vector_rag", query=query, top_k=top_k, filters=filters)
            graph_hits = tools.call("graph_rag", query=query, top_k=top_k, filters=filters)
        # LLM 生成的过滤器（venue/domain/time_range）可能过度过滤导致空召回：
        # 回退用原始 query + 无过滤器重试，保证检索始终有结果。
        if use_local and not remote_hits and not vector_hits and not graph_hits:
            vector_hits = tools.call("vector_rag", query=query, top_k=top_k, filters=None)
            graph_hits = tools.call("graph_rag", query=query, top_k=top_k, filters=None)

        # 阶段2.5 联网检索（可选）：补充互联网最新来源；失败降级为仅本地结果，不阻断检索链路。
        # 优先用 LLM 规划产出的英文检索式（Exa 对英文学术查询的召回质量明显更好）。
        web_hits: list[dict] = []
        if web_search_on:
            web_query = (plan.web_query or "").strip() or query
            try:
                web_hits = _web_results_to_hits(
                    tools.call("web_search", query=web_query, top_k=settings.web_search_top_k)
                )
            except Exception as exc:
                logger.warning("web_search 调用失败，忽略联网结果：%s", exc)

        # 阶段3. 去重排序 + 质量验证（优先数据自带 match 等级），再生成最终输出
        seen: dict[str, dict] = {}
        for hit in remote_hits + vector_hits + graph_hits + web_hits:
            seen.setdefault(hit["paper_id"], hit)

        timestamp = datetime.now(timezone.utc).isoformat()
        papers: list[RetrievedPaper] = []
        for hit in seen.values():
            venue = hit.get("venue") or ""
            heat = hit.get("heat") or ""
            # 质量分级：四维 checklist（相关度/CCF/引用/时效）→ 三级，替代关键词启发式
            level = checklist_match_level(
                float(hit.get("_score", 0.0)),
                hit.get("ccf"),
                hit.get("citation_count", 0),
                hit.get("year", 0),
            ).upper()
            papers.append(
                RetrievedPaper(
                    paper_id=hit["paper_id"],
                    title=hit["title"],
                    author=hit.get("author", ""),
                    year=hit.get("year", 0),
                    institute=hit.get("institute"),
                    citation_count=hit.get("citation_count", 0),
                    reference_ids=hit.get("references", []),
                    match_level=level,
                    evidence_snippet=venue or heat,
                    retrieval_timestamp=timestamp,
                    db_source=hit.get("db_source") or "VectorRAG+GraphRAG",
                    abstract=hit.get("abstract") or "",
                    ccf=hit.get("ccf"),
                    heat=heat or None,
                    match_label=level.lower(),
                    keywords=hit.get("keywords", []),
                    relevance_score=float(hit.get("_score", 0.0)),
                    pdf_url=hit.get("pdf_url"),
                    url=hit.get("url"),
                )
            )

        # 相关度降序（BM25 饱和分/余弦/PageRank，源端已归一化到 0..1），同分按引用数降序
        papers.sort(key=lambda p: (-p.relevance_score, -p.citation_count))

        # 优化：跳过第②次 LLM 生成，直接用工具实际召回结果构造 ScoutOutput。
        # 原实现再调一次 LLM 生成 output（易幻觉出 citation key），随后又被强制
        # 覆盖 retrieved_papers —— 那次往返对最终结果无贡献，纯浪费一次 LLM 调用。
        output = ScoutOutput(status="SUCCESS", retrieved_papers=papers)
        wm = self.remember(state, "retrieve papers", output.model_dump(), paper_ids=[p.paper_id for p in output.retrieved_papers])
        return {"last_output": output.model_dump(), "working_memory": wm}
