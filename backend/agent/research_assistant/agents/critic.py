"""Critic（论文审查与决策）：模拟顶会审稿人，事实核查 + 格式审计 + 投稿匹配决策。

文献综述步骤（action 含 "review citations and structure"）时，直接审查
writer 产出的综述 Markdown：结构完整性（摘要/维度/每节要点/参考文献）与
引用合法性（[n] 不越界、无悬空），产出可执行审稿意见供 writer 修订回环使用。
"""
from __future__ import annotations

import re

from research_assistant.agents.base import BaseAgent
from research_assistant.llm import LLMProvider
from research_assistant.schemas import (
    CriticOutput,
    CriticPlan,
    Issue,
    ReviewReport,
    VenueMatch,
    VenueMatchingAnalysis,
)
from research_assistant.tools import tools

SYSTEM_PROMPT = (
    "你是一位严苛的顶会 Senior Area Chair 审稿人，具备以下审查标准：\n"
    "\n"
    "【三维评估体系】\n"
    "1. 事实真实性（Soundness）\n"
    "   - 检测虚假引用和伪造数据\n"
    "   - 验证实验结果的统计显著性\n"
    "   - 检查方法论的逻辑严密性\n"
    "2. 创新性评估（Novelty）\n"
    "   - 对比相关工作，量化贡献差异\n"
    "   - 评估理论突破或应用拓展的价值\n"
    "   - 判断是否达到发表门槛\n"
    "3. 表达质量（Presentation）\n"
    "   - 检查格式合规性（页数、匿名、引用格式）\n"
    "   - 评估图表清晰度和可读性\n"
    "   - 验证语言流畅性和语法正确性\n"
    "\n"
    "【决策输出】\n"
    "- 给出明确的 Accept/Reject/Revise 决定\n"
    "- 提供详细的修改建议和 action items\n"
    "- 匹配最适合的投稿 venue 并说明理由\n"
    "\n"
    "【禁止事项】\n"
    "严禁基于个人偏好而非客观标准进行评判；不得对特定研究领域或方法存在系统性偏见；禁止泄露审稿过程中"
    "的敏感信息；不允许因语言风格问题否定实质性的学术贡献；不得给出模糊不清或无法执行的修改建议。"
)

# 综述正文中「## 」级小节的保留章节（不计入研究维度节；前缀匹配以兼容「研究脉络（2017-2024）」等带范围标题）
_RESERVED_PREFIXES = ("摘要", "核心发现", "对比表", "研究脉络", "参考文献")
_CITE_TOKEN = re.compile(r"\[([0-9,\s\-–—]+)\]")
_HEADING2 = re.compile(r"^##\s+(.+?)\s*$")


def _is_reserved(title: str) -> bool:
    return any(title.startswith(prefix) for prefix in _RESERVED_PREFIXES)


def _parse_cite_numbers(s: str) -> list[int]:
    nums: list[int] = []
    for part in re.split(r"[,\s]+", s.strip()):
        if not part:
            continue
        m = re.match(r"^(\d+)\s*[-–—]\s*(\d+)$", part)
        if m:
            lo, hi = int(m.group(1)), int(m.group(2))
            if lo <= hi and hi - lo < 64:
                nums.extend(range(lo, hi + 1))
            continue
        try:
            nums.append(int(part))
        except ValueError:
            continue
    return nums


def _review_markdown_issues(markdown: str) -> list[dict]:
    """审查综述 Markdown：结构完整性与引用合法性，返回 issue dict 列表。"""
    issues: list[dict] = []
    if not markdown:
        issues.append({
            "type": "Format Error",
            "location": "Document",
            "detail": "未收到综述正文（writer 未产出 Markdown 文件）。",
            "action_required": "重新生成综述文件后再次审查。",
        })
        return issues

    lines = markdown.splitlines()
    headings = [ln for ln in lines if ln.startswith("#")]
    text = "\n".join(lines)

    # 1. 结构完整性
    if not any(ln.startswith("# ") for ln in lines):
        issues.append({"type": "Format Error", "location": "Document",
                       "detail": "缺少一级标题。", "action_required": "补充综述标题。"})
    if "## 摘要" not in text:
        issues.append({"type": "Format Error", "location": "摘要",
                       "detail": "缺少「## 摘要」小节。", "action_required": "补充开篇摘要。"})

    dim_titles = [
        _HEADING2.match(ln).group(1).strip()
        for ln in lines
        if _HEADING2.match(ln) and not _is_reserved(_HEADING2.match(ln).group(1).strip())
    ]
    if not dim_titles:
        issues.append({"type": "Format Error", "location": "正文",
                       "detail": "缺少研究维度小节（至少一个「## 维度」节）。",
                       "action_required": "补充按维度组织的综述正文。"})

    # 每个维度节必须自带「### 要点」
    dim_has_points: dict[str, bool] = {}
    current_dim: str | None = None
    for ln in lines:
        m = _HEADING2.match(ln)
        if m:
            title = m.group(1).strip()
            current_dim = title if not _is_reserved(title) else None
            if current_dim:
                dim_has_points[current_dim] = False
            continue
        if current_dim and ln.lstrip().startswith("### ") and "要点" in ln:
            dim_has_points[current_dim] = True
    for title, has_points in dim_has_points.items():
        if not has_points:
            issues.append({"type": "Format Error", "location": f"维度「{title}」",
                           "detail": "该维度节末尾缺少「### 要点」小节。",
                           "action_required": "为每个维度节补充 2-3 条要点。"})

    # 2. 引用合法性：正文 [n] 不得越过参考文献条目数
    ref_section = text.split("## 参考文献", 1)
    body_text = ref_section[0]
    refs_text = ref_section[1] if len(ref_section) > 1 else ""
    n_refs = len([ln for ln in refs_text.splitlines() if re.match(r"^\[\d+\]", ln.strip())])
    cited = []
    for m in _CITE_TOKEN.finditer(body_text):
        cited.extend(_parse_cite_numbers(m.group(1)))
    dangling = sorted({n for n in cited if n < 1 or n > n_refs})
    if dangling:
        issues.append({"type": "Fake Citation", "location": "正文引用",
                       "detail": f"存在越界引用编号 {dangling}（参考文献共 {n_refs} 条）。",
                       "action_required": "修正或删除越界引用编号。"})
    if n_refs == 0 and cited:
        issues.append({"type": "Format Error", "location": "参考文献",
                       "detail": "正文有引用但缺少参考文献条目。",
                       "action_required": "补充参考文献章节。"})
    return issues


class CriticAgent(BaseAgent):
    name = "critic"

    def __init__(self, llm: LLMProvider) -> None:
        super().__init__(llm)
        self.system_prompt = SYSTEM_PROMPT

    def run(self, state: dict) -> dict:
        query = state["user_query"]
        wm = state.get("working_memory") or {}
        ev = wm.get("evidence_chain_index") or {}
        paper_ids = ev.get("paper_ids") or []
        last_output = state.get("last_output") or {}

        # 判断当前步骤是否为「文献综述审查」：writer 修订回环的中间审查步骤
        plan = state.get("task_plan") or []
        idx = state.get("plan_index") or 0
        step_action = plan[idx].get("action", "") if idx < len(plan) else ""
        review_task = "review citations and structure" in step_action or "review literature review" in step_action

        # 阶段1. LLM 规划：确定目标会议与审查清单（mock 回显确定性计划）
        plan_model: CriticPlan = self.generate(
            {"user_query": query, "paper_latex": "", "available_evidence": paper_ids, "review_task": review_task},
            CriticPlan,
            {"target_venue": None, "checklist": ["hallucination_check", "format_check", "novelty_check"]},
        )

        # 阶段2. 证据与文本提取
        writer_out = (wm.get("agent_outputs") or {}).get("writer") or {}
        writer_files = writer_out.get("generated_files") or []
        review_md = next((f.get("content", "") for f in writer_files if f.get("language") == "markdown"), "")
        writer_cited = (last_output.get("written_content") or {}).get("cited_paper_ids") or []
        if not writer_cited:
            writer_cited = (writer_out.get("written_content") or {}).get("cited_paper_ids") or []

        issues = []
        if review_task:
            # 综述审查：结构 + 引用合法性（审查对象 = writer 产出的 Markdown 文件）
            for issue in _review_markdown_issues(review_md):
                issues.append(Issue(**issue))
            # 引用不在证据链内（幽灵引用）
            fake_citations = [c for c in writer_cited if c not in paper_ids]
            if fake_citations:
                issues.append(Issue(
                    type="Fake Citation",
                    location="Reference Section",
                    detail=f"以下引用不在证据链中: {fake_citations}",
                    action_required="删除或替换为证据链内文献",
                ))
            venue_hits = []
            match_reason = ""
        else:
            # 论文审查：幻觉引用核查 + 投稿匹配
            fake_citations = [c for c in writer_cited if c not in paper_ids]
            if fake_citations:
                issues.append(Issue(
                    type="Fake Citation",
                    location="Reference Section",
                    detail=f"以下引用不在证据链中: {fake_citations}",
                    action_required="删除或替换为证据链内文献",
                ))
            venue_hits = tools.call("venue_db", query=plan_model.target_venue or query)
            match_reason = f"依据 {query} 方向与会议接收率计算的匹配度。"

        recommended = [
            VenueMatch(name=v["venue"], score=int(v.get("match_pct", v.get("rate", 0))))
            for v in venue_hits[:3]
        ]

        # 4. 生成多维评分矩阵与复盘指引，输出最优投稿策略
        decision = "ACCEPT" if not issues else "REJECT_WITH_REVISION"
        report = ReviewReport(
            decision=decision,
            overall_score=7.5 if not issues else 5.0,
            sub_scores={"soundness": 8, "novelty": 7, "presentation": 7},
            issues_found=issues,
            venue_matching_analysis=VenueMatchingAnalysis(
                recommended_venues=recommended,
                match_reason=match_reason,
            ),
        )
        output = self.generate(
            {
                "query": query,
                "plan": plan_model.model_dump(),
                "review_task": review_task,
                "review_markdown": review_md[:4000],
                "evidence_chain": paper_ids,
                "candidate_venues": [v.model_dump() for v in recommended],
                "draft_report": report.model_dump(),
            },
            CriticOutput,
            {"status": "SUCCESS", "review_report": report.model_dump()},
        )
        wm = self.remember(state, "review paper & match venue", output.model_dump(), paper_ids=paper_ids)
        return {"last_output": output.model_dump(), "working_memory": wm}
