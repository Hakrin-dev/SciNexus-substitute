"""Writer（论文写作）：基于研究设想与学术证据链撰写、修改高可信度论文草稿。"""
from __future__ import annotations

import re

from research_assistant.agents.base import BaseAgent
from research_assistant.llm import LLMProvider
from research_assistant.schemas import ClaimEvidence, GeneratedFile, ReviewMarkdown, WrittenContent, WriterOutput, WriterPlan
from research_assistant.tools import tools
from research_assistant.tools.data_source import backend

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

REVIEW_SYSTEM_PROMPT = (
    "你是一位学术写作专家，负责撰写一篇完整的「文献综述」Markdown 文档。\n"
    "用户会提供综述主题与一批论文（标题/作者/年份/会议/摘要），每篇以 [pid] 标注。\n"
    "\n"
    "要求：\n"
    "1. 严格依据提供的论文摘要与题名撰写，严禁虚构摘要之外的结论、数据或引用；\n"
    "2. 综述必须包含以下章节（Markdown 二级标题）：\n"
    "   ## 摘要\n"
    "   ## 1. 研究背景\n"
    "   ## 2. 代表性工作\n"
    "   ## 3. 方法脉络\n"
    "   ## 4. 对比分析\n"
    "   ## 5. 未来方向\n"
    "3. 【引用要求·必须严格遵守】\n"
    "   - 正文中每句涉及具体方法、结论、实验数据或工作对比时，都必须在题名后紧跟 [pid] 标记引用"
    "     （例：Attention Is All You Need [p1] 提出了完全基于注意力的 Transformer 架构）；\n"
    "   - 不得出现没有引用支撑的事实断言；不得引用候选列表中不存在的 pid；\n"
    "   - 提供的每篇候选论文应至少被引用一次；\n"
    "4. 采用 IEEE 风格，行文客观、严谨、专业，使用中文撰写；\n"
    "5. 只输出 Markdown 正文本身（不要写「参考文献」章节，参考文献由系统自动生成编号），"
    "   不要 Markdown 代码块围栏，不要多余说明文字。"
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

    @staticmethod
    def _paper_line(pid: str) -> str:
        paper = backend.get_paper(pid) or {}
        title = paper.get("title") or pid
        author = paper.get("author") or "Unknown authors"
        year = paper.get("year") or ""
        venue = paper.get("venue") or "Unknown venue"
        return f"- [{pid}] {author}. {title}. {venue}, {year}."

    @staticmethod
    def _paper_summary(pid: str) -> str:
        paper = backend.get_paper(pid) or {}
        title = paper.get("title") or pid
        abstract = (paper.get("abstract") or "暂无摘要。").strip().replace("\n", " ")
        if len(abstract) > 220:
            abstract = abstract[:220].rstrip() + "..."
        return f"- **{title}** [{pid}]：{abstract}"

    @staticmethod
    def _llm_paper_blob(pid: str) -> str:
        """供 LLM 综述生成的论文信息块：题名/作者/会议/年份 + 完整摘要，附 [pid] 标记。"""
        paper = backend.get_paper(pid) or {}
        title = paper.get("title") or pid
        author = paper.get("author") or "Unknown authors"
        year = paper.get("year") or ""
        venue = paper.get("venue") or "Unknown venue"
        abstract = (paper.get("abstract") or "暂无摘要。").strip().replace("\n", " ")
        return (
            f"- [{pid}] {author}. {title}. {venue}, {year}.\n"
            f"  摘要: {abstract}"
        )

    @staticmethod
    def _numbered_reference(pid: str, n: str) -> str:
        """生成编号参考文献条目：[n] 作者. 标题. 会议, 年份."""
        paper = backend.get_paper(pid) or {}
        title = paper.get("title") or pid
        author = paper.get("author") or "Unknown authors"
        year = paper.get("year") or ""
        venue = paper.get("venue") or "Unknown venue"
        return f"[{n}] {author}. {title}. {venue}, {year}."

    @classmethod
    def _number_citations(cls, review_md: str, cited: list[str]) -> str:
        """把正文 [pid] 标记替换为按首次出现顺序编号的 [1][2]...，并追加编号参考文献章节。

        LLM 生成的正文用 [pid] 占位，此处统一转成规范的数字引用，保证引用与
        参考文献一一对应，且不存在幽灵引用。
        """
        appeared: list[tuple[int, str]] = []
        for pid in cited:
            pos = review_md.find(f"[{pid}]")
            if pos >= 0:
                appeared.append((pos, pid))
        appeared.sort(key=lambda x: x[0])
        ordered = [pid for _, pid in appeared] or list(cited)
        num = {pid: str(i + 1) for i, pid in enumerate(ordered)}
        body = review_md
        for pid in ordered:
            body = body.replace(f"[{pid}]", f"[{num[pid]}]")
        refs = "\n".join(cls._numbered_reference(pid, num[pid]) for pid in ordered)
        return body.rstrip() + "\n\n## 参考文献\n\n" + refs + "\n"

    def _build_literature_review_files(self, query: str, cited: list[str], latex: str,
                                       review_md: str | None = None) -> list[GeneratedFile]:
        """组装最终 GeneratedFile 列表（docs/*.md + paper/*.tex）。

        review_md 由真实模式 LLM 生成；为 None 时（mock 模式）使用确定性模板。
        """
        topic = self._topic_title(query)
        slug = self._topic_slug(query)
        cited = cited[:20]
        references = "\n".join(self._paper_line(pid) for pid in cited) or "- 暂无可用引用，请先完成论文检索。"
        summaries = "\n".join(self._paper_summary(pid) for pid in cited[:10]) or "- 暂无可用论文摘要。"
        if not review_md:
            review_md = f"""# {topic}：文献综述

## 摘要
本文围绕“{topic}”梳理已有研究脉络，重点关注代表性方法、技术演进、实验范式与未来问题。综述基于当前论文库检索结果生成，引用条目均来自已加载数据库。

## 1. 研究背景
该方向的发展通常由基础模型、任务需求和工程约束共同推动。早期工作侧重核心机制验证，后续研究逐渐转向效率、可扩展性、泛化能力和真实场景部署。

## 2. 代表性工作
{summaries}

## 3. 方法脉络
从已检索论文看，相关研究大体可分为三条路线：一是通过架构设计提升表达能力；二是通过训练策略与数据构造改善泛化；三是通过系统优化降低部署成本。

## 4. 对比分析
| 维度 | 主要关注点 | 写作建议 |
| --- | --- | --- |
| 方法创新 | 架构、目标函数、训练范式 | 对比核心假设和适用边界 |
| 实验设置 | 数据集、指标、baseline | 优先引用公开可复现实验 |
| 工程价值 | 复杂度、显存、延迟 | 区分研究原型和生产部署 |

## 5. 未来方向
未来研究可进一步关注长上下文处理、低资源适配、可信评测、跨领域迁移和可解释性。若用于正式论文，建议继续补充近两年顶会论文并扩展实验对比表。

## 参考文献
{references}
"""
        return [
            GeneratedFile(path=f"docs/{slug}_文献综述.md", language="markdown", content=review_md),
            GeneratedFile(path=f"paper/{slug}_review.tex", language="latex", content=latex),
        ]

    def run(self, state: dict) -> dict:
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
        #    真实模式不调用该 mock 工具，IEEE/客观风格要求已折叠进 REVIEW_SYSTEM_PROMPT。
        if self.mock:
            latex = tools.call("dpo_align", text=latex, style=plan.style_preference)

        # 5. 文献综述正文：真实模式由 LLM 依据论文摘要/[pid] 引用撰写，mock 模式用确定性模板。
        if self.mock:
            generated_files = self._build_literature_review_files(query, cited, latex)
        else:
            papers = "\n\n".join(self._llm_paper_blob(pid) for pid in cited) or "（无可用论文，请先完成检索）"
            review_md = self.llm.complete(
                REVIEW_SYSTEM_PROMPT,
                {"topic": self._topic_title(query), "papers": papers},
                ReviewMarkdown,
            ).markdown
            # 把正文 [pid] 占位转成规范数字引用 [1][2]...，并追加编号参考文献
            review_md = self._number_citations(review_md, cited)
            generated_files = self._build_literature_review_files(query, cited, latex, review_md)

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
