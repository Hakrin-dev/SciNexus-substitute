"""Writer（论文写作）：基于研究设想与学术证据链撰写、修改高可信度论文草稿。

文献综述分支（literature_review）走 `review.build_literature_review` 管线
（移植自 SZDR paperreport：三阶段综合 + 引用解析 + 质量签名小节），
mock 与真实模式共用同一代码路径，产出 docs/*.md + paper/*.tex 两个文件。
"""
from __future__ import annotations

import re

from research_assistant.agents.base import BaseAgent
from research_assistant.llm import LLMProvider
from research_assistant.review import build_literature_review, revise_literature_review
from research_assistant.schemas import ClaimEvidence, GeneratedFile, WrittenContent, WriterOutput, WriterPlan
from research_assistant.tools import tools

SYSTEM_PROMPT = (
    "你是一位学术写作专家，精通顶级期刊会议的写作规范：\n"
    "\n"
    "【写作原则】\n"
    "1. 事实准确性：所有引用必须存在于证据链中，严禁虚构\n"
    "2. 逻辑连贯性：段落间使用过渡句连接，避免跳跃式论述\n"
    "3. 表达客观性：避免主观形容词，使用被动语态和第三人称\n"
    "4. 格式规范性：严格遵循目标会议的 LaTeX 模板要求\n"
    "\n"
    "【质量控制】\n"
    "- 每句话包含断言时必须映射到具体证据\n"
    "- 复杂概念用例子或类比进行解释\n"
    "- 图表标题自包含，无需回看正文即可理解\n"
    "- 摘要控制在 250 字以内，包含背景、方法、结果、结论四要素\n"
    "\n"
    "【禁止事项】\n"
    "严禁虚构任何参考文献、作者或 DOI 编号；不得抄袭他人作品而不正确引用；禁止使用歧视性、偏见性或"
    "不当语言；不允许夸大研究成果的实际意义；不得违反目标会议的匿名投稿规则。"
)


class WriterAgent(BaseAgent):
    name = "writer"

    def __init__(self, llm: LLMProvider) -> None:
        super().__init__(llm)
        self.system_prompt = SYSTEM_PROMPT

    @staticmethod
    def _topic_title(query: str) -> str:
        topic = query
        for token in ("请帮我", "帮我", "请", "生成一个", "生成", "撰写一篇关于", "撰写", "写一篇关于", "写一篇", "文献综述", "综述"):
            topic = topic.replace(token, " ")
        topic = re.sub(r"[「」：《》:，。,.\s]+", " ", topic).strip()
        return topic or query

    @classmethod
    def _topic_slug(cls, query: str) -> str:
        cleaned = re.sub(r"[^\w\u4e00-\u9fff-]+", "_", cls._topic_title(query)).strip("_")
        return (cleaned[:36] or "literature_review").lower()

    def _build_literature_review_files(self, query: str, latex: str, review_md: str) -> list[GeneratedFile]:
        """组装最终 GeneratedFile 列表（docs/*.md + paper/*.tex）。

        review_md 由 `review.build_literature_review` 生成（mock 与真实模式同路径），
        已包含完整的「## 参考文献」节。
        """
        topic = self._topic_title(query)
        slug = self._topic_slug(query)
        if not review_md:
            review_md = f"# {topic}：文献综述\n\n> 当前论文库未检索到可用文献，请先完成论文检索后再生成综述。\n"
        return [
            GeneratedFile(path=f"docs/{slug}_文献综述.md", language="markdown", content=review_md),
            GeneratedFile(path=f"paper/{slug}_review.tex", language="latex", content=latex),
        ]

    @staticmethod
    def _critic_feedback_text(review_report: dict) -> str:
        """把 critic 的 ReviewReport 转成可执行的审稿意见文本。"""
        report = review_report or {}
        decision = report.get("decision") or "ACCEPT"
        lines = [f"审稿决策：{decision}"]
        issues = report.get("issues_found") or []
        for issue in issues:
            detail = issue.get("detail") or ""
            location = issue.get("location") or ""
            action = issue.get("action_required") or ""
            lines.append(f"- [{issue.get('type') or 'Issue'}] {location}：{detail}"
                         + (f"（建议：{action}）" if action else ""))
        if not issues:
            lines.append("- 未发现必须修改的问题，可仅做语言与结构润色。")
        return "\n".join(lines)

    def _run_revision(self, state: dict) -> dict:
        """修订模式：critic 审查后回写。定向改写正文（不重新聚类/提取论断），
        引用与质量 passes 由 `review.revise_literature_review` 重跑保证一致。

        不调用 self.generate（避免额外 LLM 规划往返）；以修订后的生成文件为准。
        """
        query = state["user_query"]
        wm = dict(state.get("working_memory") or {})
        outputs = dict(wm.get("agent_outputs") or {})
        prev_writer = outputs.get("writer") or {}
        files = list(prev_writer.get("generated_files") or [])

        md_index = next((i for i, f in enumerate(files) if f.get("language") == "markdown"), None)
        prev_md = files[md_index].get("content", "") if md_index is not None else ""
        prev_latex = next((f.get("content", "") for f in files if f.get("language") == "latex"), "")
        cited = list(prev_writer.get("written_content", {}).get("cited_paper_ids") or [])

        critic_out = state.get("last_output") or {}
        feedback = self._critic_feedback_text(critic_out.get("review_report") or {})
        topic = self._topic_title(query)

        revised_md = prev_md
        if prev_md:
            revised_md = revise_literature_review(self.llm, self.mock, topic, prev_md, feedback, cited)
        if md_index is not None:
            files[md_index] = {**files[md_index], "content": revised_md}

        content = WrittenContent(
            section_name="Revision",
            latex_payload=prev_latex or "",
            cited_paper_ids=cited,
            claim_evidence_map=[],
        )
        output = WriterOutput(
            status="SUCCESS",
            written_content=content,
            generated_files=[GeneratedFile(**f) for f in files],
        )
        wm = self.remember(state, "revise literature review after feedback", output.model_dump(), paper_ids=cited)
        return {"last_output": output.model_dump(), "working_memory": wm}

    def run(self, state: dict) -> dict:
        # 修订模式：当前计划步骤的 action 含 "revise"（writer→critic→writer 回环第二步）
        plan = state.get("task_plan") or []
        idx = state.get("plan_index") or 0
        step_action = plan[idx].get("action", "") if idx < len(plan) else ""
        if "revise" in step_action:
            return self._run_revision(state)

        query = state["user_query"]
        wm = state.get("working_memory") or {}
        ev = wm.get("evidence_chain_index") or {}
        paper_ids = ev.get("paper_ids") or []

        # 阶段1. LLM 规划：确定章节类型、目标风格与拟引用文献（mock 回显确定性计划）
        plan: WriterPlan = self.generate(
            {"user_query": query, "available_papers": paper_ids[:20]},
            WriterPlan,
            {"section_type": "Abstract", "style_preference": "IEEE", "cited_paper_ids": paper_ids[:20]},
        )

        # 阶段2. 工具执行：从全局工作记忆中提取证据链 Chunk 作为断言锚点
        chunks = []
        for pid in plan.cited_paper_ids:
            chunks.extend(tools.call("pdf_parser", paper_id=pid).get("chunks", []))
        anchors = [c["chunk_id"] for c in chunks[:3]]

        # 阶段3. 生成包含真实引用的 LaTeX 文本，建立「断言-证据」映射表
        cited = list(plan.cited_paper_ids) or paper_ids[:20]
        latex = (
            "\\section{Abstract}\n"
            f"我们针对 {query} 展开研究，相关工作建立在已有成果之上"
            + "".join(f"~\\cite{{{pid}}}" for pid in cited)
            + "。\n"
        )
        claim_map = [
            ClaimEvidence(claim=f"已有工作 {pid} 为本文提供基础。", source_chunk_id=anchors[i] if i < len(anchors) else "")
            for i, pid in enumerate(cited)
        ]

        # 4. 风格对齐：mock 模式通过 dpo_align 工具打标（保持 supervisor 工具白名单一致）；
        #    真实模式不调用该 mock 工具，客观写作风格已折叠进各步提示词。
        if self.mock:
            latex = tools.call("dpo_align", text=latex, style=plan.style_preference)

        # 5. 文献综述正文：三阶段综合管线（论断 → 维度 → 成文）+ 引用解析 + 质量 passes，
        #    mock 与真实模式走同一代码路径。
        topic = self._topic_title(query)
        review_md, _ = build_literature_review(self.llm, self.mock, topic, cited)
        generated_files = self._build_literature_review_files(query, latex, review_md)

        content = WrittenContent(
            section_name=plan.section_type,
            latex_payload=latex,
            cited_paper_ids=cited,
            claim_evidence_map=claim_map,
        )
        output = self.generate(
            {"query": query, "plan": plan.model_dump(), "evidence_anchors": anchors, "draft_content": content.model_dump()},
            WriterOutput,
            {
                "status": "SUCCESS",
                "written_content": content.model_dump(),
                "generated_files": [file.model_dump() for file in generated_files],
            },
        )
        # 最终生成文件以实际组装的列表为准（docs/*.md + paper/*.tex），
        # 避免真实模式下 LLM 输出与组装文件不一致。
        output.generated_files = generated_files
        wm = self.remember(state, "write paper draft", output.model_dump(), paper_ids=cited)
        return {"last_output": output.model_dump(), "working_memory": wm}
