"""Research Design（研究设计）：探索科研前沿、生成创新假设、设计实验方案。"""
from __future__ import annotations

from research_assistant.agents.base import BaseAgent
from research_assistant.llm import LLMProvider
from research_assistant.schemas import ResearchDesignOutput

SYSTEM_PROMPT = (
    "你是一位科研规划顾问，擅长发现研究空白并设计可行方案：\n"
    "\n"
    "【创新评估】\n"
    "1. 新颖性分析：对比现有工作，量化创新程度（高/中/低）\n"
    "2. 可行性判断：考虑计算资源、数据获取、技术成熟度\n"
    "3. 风险识别：预判可能的技术瓶颈和替代方案\n"
    "\n"
    "【方案设计】\n"
    "- 提出具体可验证的假设（H0 vs H1）\n"
    "- 设计对照实验和消融研究\n"
    "- 制定里程碑式的技术路线图\n"
    "- 预估所需时间和资源投入\n"
    "\n"
    "【禁止事项】\n"
    "严禁提出违反科学伦理的研究方案；不得夸大创新性的实际价值；禁止忽略技术可行性和资源约束；"
    "不允许推荐存在知识产权风险的技术路径；不得提供可能误导后续实验的错误指导。\n"
    "\n"
    "补充定位：你也是一位专业的科研规划助手，任务是基于已有文献、研究趋势和用户需求，辅助研究者"
    "分析当前领域的发展现状，发现潜在研究问题与改进空间，并设计合理、可验证的研究方案。你需要避免"
    "夸大创新性，应根据已有研究基础评估方案的新颖程度、技术可行性和潜在价值。"
)


class ResearchDesignAgent(BaseAgent):
    name = "research_design"

    def __init__(self, llm: LLMProvider) -> None:
        super().__init__(llm)
        self.system_prompt = SYSTEM_PROMPT

    def run(self, state: dict) -> dict:
        query = state["user_query"]
        wm = state.get("working_memory") or {}
        ev = wm.get("evidence_chain_index") or {}
        baselines = ev.get("paper_ids") or []

        # SOP1. 现状调研：整合 Scout 和 Librarian 的输出，形成领域全景图
        scout_out = (wm.get("agent_outputs") or {}).get("scout", {})
        librarian_out = (wm.get("agent_outputs") or {}).get("librarian", {})
        scout_papers = scout_out.get("retrieved_papers", [])
        paper_titles = [p.get("title", "") for p in scout_papers if p.get("title")]
        paper_years = sorted(p.get("year", 0) for p in scout_papers if p.get("year"))
        domain_snapshot = {
            "scout_papers": paper_titles,
            "paper_count": len(scout_papers),
            "year_range": [paper_years[0], paper_years[-1]] if paper_years else None,
            "librarian_nodes": len((librarian_out.get("graph_data") or {}).get("nodes", [])),
        }

        # SOP2-5. gap 识别 / 假设生成 / 实验设计 / 可行性评估（用真实检索到的论文驱动）
        tech_roadmap = [
            f"现状调研：复现 {paper_titles[0] if paper_titles else '核心基线'} 并梳理技术演进时间线"
            + (f"（{paper_years[0]}~{paper_years[-1]}）" if paper_years else ""),
            "方法实现：核心改进 + 消融实验",
            "可行性评估：算力/数据/周期预估 + 跨数据集泛化验证",
        ]
        proposal = {
            "title": f"面向「{query}」的可验证研究方案",
            "core_hypothesis": (
                f"H0: 现有方法（{baselines[:2]}）在「{query}」上已达上限；H1: 通过针对性改进可显著提升。"
            ),
            "novelty_analysis": {
                "level": "medium",
                "comparison_with_existing_work": f"相比 {paper_titles[:3]} 等近期工作，在方法与场景上存在差异化空间。",
                "innovation_type": ["method improvement", "application extension"],
            },
            "experimental_design": {
                "datasets": ["标准公开数据集 A", "领域基准数据集 B"],
                "baselines": paper_titles[:3] or baselines[:3],
                "metrics": ["accuracy", "F1", "效率"],
            },
            "technology_evolution_roadmap": tech_roadmap,
        }
        output = self.generate(
            {"query": query, "baselines": baselines, "domain_snapshot": domain_snapshot, "draft_proposal": proposal},
            ResearchDesignOutput,
            {"status": "SUCCESS", "proposal": proposal},
        )
        wm = self.remember(state, "design research proposal", output.model_dump(), paper_ids=baselines)
        return {"last_output": output.model_dump(), "working_memory": wm}
