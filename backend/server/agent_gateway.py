"""Server -> Agent 网关：把 FastAPI 的搜索/对话转发到多智能体框架。

通过环境变量 AGENT_ENABLED 控制（默认 true；false 则回退到 server 自带 mock）。
agent 包懒加载（首次调用才 import 并构建数据后端），避免拖慢 server 启动。
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent
AGENT_DIR = SERVER_DIR.parent / "agent"
if str(AGENT_DIR) not in sys.path:
    sys.path.insert(0, str(AGENT_DIR))

AGENT_ENABLED = os.getenv("AGENT_ENABLED", "true").lower() not in ("0", "false", "no")

from server.serializers import serialize_paper  # noqa: E402


def _run_agent(user_query: str, task_type: str | None = None,
               paper_id: str | None = None, history: list[dict] | None = None) -> dict:
    """运行一次 agent 工作流，返回完整 result 状态。

    paper_id/history 传入初始状态：synthesis 等 agent 据此定位论文并保持多轮上下文。
    """
    from research_assistant.graph import build_graph  # noqa: PLC0415

    graph = build_graph(checkpoint=False)
    initial = {
        "user_query": user_query,
        "plan_index": 0,
        "working_memory": {
            "session_context": [],
            "evidence_chain_index": {"paper_ids": []},
            "agent_outputs": {},
        },
    }
    if paper_id:
        initial["paper_id"] = paper_id
    if history:
        initial["history"] = history
    if task_type:
        initial["raw_input"] = {"task_type": task_type}
    return graph.invoke(initial)


def _to_frontend_paper(p: dict, structured: dict | None = None) -> dict:
    """agent 内部论文契约 -> 前端对齐结构（数据字段，视觉字段由前端派生）。

    structured 仅在非 None 时写入返回 dict，保证列表场景（search_papers/list_papers）
    的载荷与详情场景一致。
    """
    result = serialize_paper(p)
    if structured is not None:
        result["structured"] = structured
    return result


def _workflow_trace(result: dict) -> dict:
    """把 LangGraph 运行态压缩成前端可展示的流程轨迹。"""
    plan = result.get("task_plan") or []
    outputs = (result.get("working_memory") or {}).get("agent_outputs") or {}
    errors = result.get("errors") or []
    failed_agents = {e.get("agent") for e in errors if e.get("agent")}
    steps = [
        {"agent": "supervisor", "action": "规划任务并授权工具", "status": "done"}
    ]
    for step in plan:
        agent = step.get("agent", "")
        if agent in failed_agents:
            status = "failed"
        elif agent in outputs:
            status = "done"
        else:
            status = "pending"
        steps.append({
            "agent": agent,
            "action": step.get("action", ""),
            "status": status,
            "tools": step.get("authorized_tools", []),
        })
    return {
        "task_id": (result.get("intent") or {}).get("task_id", ""),
        "agents": (result.get("intent") or {}).get("required_agents", []),
        "steps": steps,
        "errors": errors,
        "status": ((result.get("working_memory") or {}).get("task_state") or {}).get("status", "done"),
    }


def _direct_search(query: str, top_k: int) -> list[dict]:
    """Supervisor/LLM 不可用时，直接使用已初始化的数据后端检索（附相关度与质量分级）。

    两阶段：① RRF 混合召回（稠密 + BM25 + 图）top_k*3；② 交叉编码器精排（可选，
    不可用则保持 RRF 顺序）。
    """
    from research_assistant.tools.data_source import backend  # noqa: PLC0415
    from research_assistant.tools.quality import checklist_match_level  # noqa: PLC0415
    from research_assistant.tools.reranker import reranker  # noqa: PLC0415
    from research_assistant.tools.text_utils import tokenize_query  # noqa: PLC0415

    by_id = {p["paper_id"]: p for p in backend.papers}
    # 阶段1：RRF 混合召回（多召回一些候选供交叉编码器精排）
    hits = backend.hybrid_search(query, top_k * 3)
    papers: list[dict] = []
    for h in hits:
        p = by_id.get(h["paper_id"])
        if p:
            p = dict(p)
            p["relevance_score"] = float(h["score"])
            papers.append(p)
    # 阶段2：交叉编码器精排（覆盖 relevance_score 为交叉编码分；不可用则保持 RRF 顺序）
    papers = reranker.rerank(query, papers, top_k)
    # 质量分级：四维 checklist（相关度/CCF/引用/时效）→ perfect/partial/weak
    for p in papers:
        p["match_label"] = checklist_match_level(
            p["relevance_score"],
            p.get("ccf"),
            p.get("citation_count", 0),
            p.get("year", 0),
        )
    if papers:
        return papers[:top_k]

    tokens = tokenize_query(query)
    fallback = []
    if tokens:
        for p in backend.papers:
            blob = " ".join([p.get("title", ""), p.get("abstract", ""), " ".join(p.get("keywords", []))]).lower()
            if any(t in blob for t in tokens):
                fallback.append(p)
    return fallback[:top_k]


QUICK_ANSWER_PROMPT = (
    "你是研枢（SciNexus）科研助手的快速检索总结器。用户提出一个科研问题，"
    "下方是本地检索引擎召回的候选论文（标题/作者/年份/来源/摘要）。\n"
    "请用 2~4 句话**直接简要回答用户的问题**：\n"
    "1. 结论优先，必要时提及 1~2 篇最有代表性的论文（格式「标题（作者, 年份）」）作为支撑；\n"
    "2. 若论文不足以回答该问题，如实说明「当前检索到的论文不足以直接回答」，并给出最接近的检索结论；\n"
    "3. 只依据下方论文信息作答，严禁编造论文中不存在的结论；\n"
    "4. 使用中文，段落式简短回答即可，不要列论文清单（清单由系统单独展示）。"
)


def _quick_summary(query: str, papers: list[dict]) -> str:
    """快速模式的「简易回答」：基于检索结果用轻量 LLM 生成 2~4 句回答。

    LLM 不可用/异常时回退规则模板（也用于 mock 模式），保证快速链路永不阻塞。
    """
    if not papers:
        return f"关于「{query}」，当前论文库未检索到匹配结果，建议更换关键词或开启语义检索后重试。"

    def fallback() -> str:
        top = papers[0]
        title = top.get("title") or top.get("paper_id") or ""
        venue = (top.get("evidence_snippet") or top.get("venue") or "") or "arXiv"
        venues = []
        for p in papers[:5]:
            v = (p.get("evidence_snippet") or p.get("venue") or "") or "arXiv"
            if v not in venues:
                venues.append(v)
        venue_text = "、".join(venues[:3])
        return (
            f"关于「{query}」，检索到 {len(papers)} 篇相关论文。"
            f"较有代表性的是 **{title}**（来源：{venue}）"
            + (f"，主要来源包括 {venue_text}" if venue_text else "")
            + "。建议结合下方论文清单精读，或切换「深度」模式获取基于证据的综合回答。"
        )

    try:
        from research_assistant.llm import get_llm  # noqa: PLC0415
        from research_assistant.llm import MockProvider  # noqa: PLC0415

        llm = get_llm()
        if isinstance(llm, MockProvider):
            return fallback()
        payload = {
            "question": query,
            "papers": [
                {
                    "title": p.get("title") or p.get("paper_id", ""),
                    "authors": p.get("author") or "未知作者",
                    "year": p.get("year") or "",
                    "venue": (p.get("evidence_snippet") or p.get("venue") or "") or "arXiv",
                    "abstract": str(p.get("abstract") or "")[:200],
                }
                for p in papers[:6]
            ],
        }
        text = llm.chat_text(QUICK_ANSWER_PROMPT, f"问题：{query}\n\n论文信息：{payload}")
        return text if text and len(text.strip()) > 5 else fallback()
    except Exception:
        return fallback()


def search_papers(query: str, top_k: int = 10, task_type: str | None = None) -> dict:
    """论文检索：直接走本地索引（快、带相关度），返回前端兼容的 {data, meta, summary}。

    简单论文检索不再经过慢速多智能体工作流（supervisor/scout 逐次调用 LLM，
    单次可达数十秒，导致前端超时回退到无相关度的本地数据）。改为本地
    vector/BM25 直检，相关度随 relevance_score 透传；summary 为基于检索结果的
    轻量「简易回答」（一次 LLM，失败回退模板）。复杂任务（研读/对话）仍走完整工作流。
    """
    papers = _direct_search(query, top_k)
    workflow = {
        "task_id": "",
        "agents": ["data_source"],
        "steps": [
            {"agent": "supervisor", "action": "识别检索意图并授权检索", "status": "done"},
            {"agent": "data_source", "action": "本地索引召回候选论文并计算相关度", "status": "done", "tools": ["vector_index"]},
        ],
        "errors": [],
        "status": "done",
    }
    if not papers:
        workflow["steps"].append({
            "agent": "data_source",
            "action": "本地论文库无匹配结果，请调整关键词或开启 Ollama 语义检索",
            "status": "done",
            "tools": [],
        })
    return {
        "data": [_to_frontend_paper(p) for p in papers],
        "summary": _quick_summary(query, papers),
        "meta": {
            "query": query,
            "count": len(papers),
            "task_type": task_type or "paper_search",
            "agents": ["data_source"],
            "workflow": workflow,
        },
    }


def match_venues(title: str, abstract: str, keywords: list[str] | None = None) -> dict:
    """投稿方向匹配（LLM 语义分析）：调用 critic agent（submission 意图）。

    返回 {"recommended_venues": [{name, score}], "match_reason": str}；
    LLM 不可用或 critic 未返回推荐时抛异常，由调用方回退到关键词匹配。
    """
    query = f"论文标题：{title}。摘要：{abstract}。"
    if keywords:
        query += f"关键词：{'、'.join(keywords)}。"
    query += "请推荐最合适的投稿会议/期刊。"
    result = _run_agent(query, task_type="submission")
    outputs = (result.get("working_memory") or {}).get("agent_outputs") or {}
    critic_out = outputs.get("critic") or {}
    report = critic_out.get("review_report") or {}
    analysis = report.get("venue_matching_analysis") or {}
    recommended = analysis.get("recommended_venues") or []
    if not recommended:
        raise RuntimeError("critic 未返回投稿推荐")
    return {
        "recommended_venues": [
            {"name": v.get("name"), "score": int(v.get("score", 0))} for v in recommended
        ],
        "match_reason": analysis.get("match_reason", ""),
    }


def _extract_references(result: dict) -> list[dict] | None:
    """从 scout 检索结果提取前端可展示的参考来源列表（供深搜页/AI 助手引用区）。

    返回 [{title, authors, venue, year, ccf, citations, match}]；无检索结果时返回 None。
    """
    outputs = (result.get("working_memory") or {}).get("agent_outputs") or {}
    scout = outputs.get("scout") or {}
    papers = scout.get("retrieved_papers") or []
    if not papers:
        return None
    refs = []
    for p in papers[:10]:
        title = (p.get("title") or "").strip()
        if not title:
            continue
        refs.append({
            "title": title,
            "authors": p.get("author") or "未知作者",
            "venue": (p.get("evidence_snippet") or p.get("venue") or "") or "arXiv",
            "year": p.get("year"),
            "ccf": p.get("ccf"),
            "citations": int(p.get("citation_count", 0) or 0),
            "match": (p.get("match_label") or p.get("match_level") or "").upper(),
        })
    return refs or None


def _extract_generated_files(result: dict) -> list[dict] | None:
    """从 writer / code_assistant 最终输出提取生成文件列表。

    返回 [{path, language, content}]；工作流未产生任何文件时返回 None。
    """
    outputs = (result.get("working_memory") or {}).get("agent_outputs") or {}
    for agent in ("writer", "code_assistant"):
        out = outputs.get(agent) or {}
        files = out.get("generated_files") or []
        if files:
            return [
                {
                    "path": f.get("path", ""),
                    "language": f.get("language", "text"),
                    "content": f.get("content", ""),
                }
                for f in files
            ]
    return None


def translate_text(text: str, target_lang: str = "中文", source_lang: str | None = None) -> str:
    """学术文本翻译：调用 LLM 层的纯文本 translate()，返回译文。

    source_lang 目前仅作接口占位（可提示模型源语言），实际翻译由 provider 完成。
    """
    from research_assistant.llm import get_llm  # noqa: PLC0415

    llm = get_llm()
    return llm.translate(text, target_lang)


def chat(message: str, task_type: str | None = None,
         paper_id: str | None = None, history: list[dict] | None = None) -> str:
    """调用 agent 全流程，返回 final_response 作为对话回复。"""
    return chat_with_meta(message, task_type, paper_id, history)["reply"]


def chat_with_meta(message: str, task_type: str | None = None,
                   paper_id: str | None = None, history: list[dict] | None = None) -> dict:
    """调用 agent 全流程，返回回复、前端可展示的工作流与生成文件列表。"""
    result = _run_agent(message, task_type, paper_id, history)
    outputs = (result.get("working_memory") or {}).get("agent_outputs") or {}
    if result.get("errors") and not outputs:
        raise RuntimeError(f"agent 工作流失败: {result.get('errors')}")
    return {
        "reply": result.get("final_response") or "（agent 未产生回复）",
        "workflow": _workflow_trace(result),
        "generated_files": _extract_generated_files(result),
        "references": _extract_references(result),
    }


def list_papers(page: int = 1, page_size: int = 10) -> dict:
    """论文列表（读 agent 数据后端，与检索同源）。"""
    from research_assistant.tools.data_source import backend  # noqa: PLC0415

    all_papers = backend.papers
    total = len(all_papers)
    start = (page - 1) * page_size
    data = [_to_frontend_paper(p) for p in all_papers[start : start + page_size]]
    return {
        "data": data,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


def get_paper(paper_id: str) -> dict | None:
    """论文详情（agent 数据后端），附带结构化分析（store 异常时降级为无 structured）。"""
    from research_assistant.tools.data_source import backend  # noqa: PLC0415

    p = backend.get_paper(paper_id)
    if not p:
        return None
    try:
        structured = backend.store.load_structured_analysis(paper_id)
    except Exception:
        structured = None
    return _to_frontend_paper(p, structured)


def recommended_papers(limit: int = 9) -> dict:
    """每日推荐：按引用量从真实论文库取前 N 篇（替代 server mock 的写死列表）。"""
    from research_assistant.tools.data_source import backend  # noqa: PLC0415

    ranked = sorted(
        backend.papers,
        key=lambda p: int(p.get("citation_count", 0) or 0),
        reverse=True,
    )[:limit]
    return {"data": [_to_frontend_paper(p) for p in ranked], "updated": "2026-08-11"}


def get_structured(paper_id: str) -> dict | None:
    """按 paper_id 读取结构化分析（兼容 mock 论文 p1-p11 等非 sqlite 论文）。"""
    from research_assistant.tools.data_source import DATA_DIR  # noqa: PLC0415
    from research_assistant.tools.store import PaperStore  # noqa: PLC0415

    try:
        store = PaperStore.open(str(DATA_DIR / "research.sqlite"))
        try:
            return store.load_structured_analysis(paper_id)
        finally:
            store.close()
    except Exception:
        return None


def _fulltext_chunk_key(c: dict) -> tuple[int, int]:
    """全文分块排序键：先页码，再 chunk_id 中的序号。

    chunk_id 形如 {paper_id}-p{page}-c{seq}；用数值序号而非字符串比较，
    避免同一页内 c10/c11 排到 c2 之前导致正文乱序。
    """
    page = int(c.get("page", 1) or 1)
    cid = str(c.get("chunk_id", "") or "")
    seq = 0
    if "-c" in cid:
        try:
            seq = int(cid.rsplit("-c", 1)[1])
        except ValueError:
            seq = 0
    return (page, seq)


def get_fulltext(paper_id: str) -> dict | None:
    """论文全文分块：有真实 PDF 时返回全文（不截断），否则回退摘要 + 结构化分析分块。

    返回 {paper_id, has_pdf, source, chunks}；chunks 按 (页码, 序号) 排序，
    每项含 chunk_id/page/text（剔除 bbox 等无关字段）。论文不存在时返回 None。
    """
    from research_assistant.tools.data_source import backend, DATA_DIR  # noqa: PLC0415
    from research_assistant.tools.pdf import parse_pdf  # noqa: PLC0415

    if backend.get_paper(paper_id) is None and not _paper_in_mock_library(paper_id):
        return None
    result = parse_pdf(paper_id, pdf_dir=DATA_DIR / "pdfs", max_chunks=None)
    source = result.get("source", "")
    has_pdf = source not in ("", "abstract_fallback", "analysis_fallback")
    chunks = [
        {
            "chunk_id": c.get("chunk_id", ""),
            "page": c.get("page", 1),
            "text": c.get("text", ""),
        }
        for c in sorted(result.get("chunks", []), key=_fulltext_chunk_key)
    ]
    return {"paper_id": paper_id, "has_pdf": has_pdf, "source": source, "chunks": chunks}


def get_paper_graph(paper_id: str) -> dict:
    """获取某论文的引用图谱（前置/衍生/同主题邻居），供前端 ECharts 可视化。

    返回 {nodes, links, originPaper, priorWorks, derivativeWorks}；论文不存在时
    nodes 为空列表，前端据此回退到 mock 演示。
    """
    from research_assistant.tools.data_source import backend  # noqa: PLC0415

    return backend.graph.get_paper_graph(paper_id)


def _paper_in_mock_library(paper_id: str) -> bool:
    """论文是否存在于 server mock 论文库（p1-p11 等未入库 agent 后端的演示论文）。

    get_paper_detail 同样在 agent 后端查不到时回退到 mock PAPERS，全文查询保持一致。
    """
    try:
        from server.data.mock_data import PAPERS  # noqa: PLC0415
    except Exception:
        return False
    return any(p.get("id") == paper_id for p in PAPERS)


def venue_stats() -> dict:
    """供统计使用：论文总数 / CCF 分布。"""
    from research_assistant.tools.data_source import backend  # noqa: PLC0415

    by_ccf: dict[str, int] = {}
    for p in backend.papers:
        ccf = p.get("ccf") or "未知"
        by_ccf[ccf] = by_ccf.get(ccf, 0) + 1
    return {"papers": {"total": len(backend.papers), "by_ccf": by_ccf}}
