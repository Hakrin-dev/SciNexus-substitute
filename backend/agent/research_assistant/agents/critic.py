"""Critic（论文审查与决策）：模拟顶会审稿人，事实核查 + 格式审计 + 投稿匹配决策。"""
from __future__ import annotations

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
        latex = (last_output.get("written_content") or {}).get("latex_payload", "")

        # 阶段1. LLM 规划：确定目标会议与审查清单（mock 回显确定性计划）
        plan: CriticPlan = self.generate(
            {"user_query": query, "paper_latex": latex, "available_evidence": paper_ids},
            CriticPlan,
            {"target_venue": None, "checklist": ["hallucination_check", "format_check", "novelty_check"]},
        )

        # 阶段2. 工具执行：逐一比对草稿引用 Tag 与双图谱数据库，核查幻觉
        writer_cited = [c["cited_paper_ids"] for c in ([last_output.get("written_content")] if last_output else [])]
        cited_ids = writer_cited[0] if writer_cited and writer_cited[0] else []
        fake_citations = [c for c in cited_ids if c not in paper_ids]
        issues = []
        if fake_citations:
            issues.append(
                Issue(
                    type="Fake Citation",
                    location="Reference Section",
                    detail=f"以下引用不在证据链中: {fake_citations}",
                    action_required="删除或替换为证据链内文献",
                )
            )

        # 3. 调用 Format Skill 核对目标会议格式要求
        venue_hits = tools.call("venue_db", query=plan.target_venue or query)
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
                match_reason=f"依据 {query} 方向与会议接收率计算的匹配度。",
            ),
        )
        output = self.generate(
            {
                "query": query,
                "plan": plan.model_dump(),
                "paper_latex": latex,
                "evidence_chain": paper_ids,
                "candidate_venues": [v.model_dump() for v in recommended],
                "draft_report": report.model_dump(),
            },
            CriticOutput,
            {"status": "SUCCESS", "review_report": report.model_dump()},
        )
        wm = self.remember(state, "review paper & match venue", output.model_dump(), paper_ids=paper_ids)
        return {"last_output": output.model_dump(), "working_memory": wm}
