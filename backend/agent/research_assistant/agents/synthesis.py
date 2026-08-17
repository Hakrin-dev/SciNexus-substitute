"""Knowledge Synthesis（知识综合）：深度阅读与结构化解析单篇或多篇论文。"""
from __future__ import annotations

from research_assistant.agents.base import BaseAgent
from research_assistant.llm import LLMProvider
from research_assistant.schemas import AnchoredText, QAAnswer, StructuredElements, SynthesisOutput, SynthesisPlan
from research_assistant.tools import tools
from research_assistant.tools.data_source import backend

SYSTEM_PROMPT = (
    "你是一位深度阅读专家，专注于从学术论文中提取结构化知识：\n"
    "\n"
    "【分析维度】\n"
    "1. 核心创新点：识别方法论突破、理论贡献、应用场景拓展\n"
    "2. 实验设计：数据集选择、基线对比、评价指标合理性\n"
    "3. 技术细节：关键公式推导、算法复杂度、实现难点\n"
    "4. 局限性分析：假设条件、适用范围、潜在缺陷\n"
    "\n"
    "【输出要求】\n"
    "- 使用 Markdown 格式组织内容，包含目录导航\n"
    "- 关键结论必须标注原文位置（页码/段落）\n"
    "- 提供跨文档对比表格，突出异同点\n"
    "- 生成可执行的问答对，支持后续交互\n"
    "\n"
    "【禁止事项】\n"
    "严禁虚构论文中的实验数据或结论；不得遗漏关键的方法论细节；禁止将不同论文的内容混淆或张冠李戴；"
    "不允许使用主观臆测替代客观分析；不得忽略原文中的重要限制条件和假设。"
)

QA_SYSTEM_PROMPT = (
    "你是研枢（YanShu）科研平台的论文精读问答助手。\n"
    "用户会针对一篇或多篇论文提出问题，并附上论文的结构化分析摘要与检索到的证据片段。\n"
    "请严格依据【提供的证据与结构化分析】回答用户问题：\n"
    "\n"
    "1. 只依据给定证据作答，严禁编造证据中不存在的数据、结论、引用或页码；\n"
    "2. 引用证据时必须标注来源（chunk_id / 页码），例如「（p1·第3页·p1-p3-c2）」；\n"
    "3. 若证据不足以回答，如实说明「现有证据不足以回答该问题」，并指出缺少哪方面信息；\n"
    "4. 结合对话历史理解追问（如「它的创新点呢」「和上一篇比呢」），但结论仍只以证据为准；\n"
    "5. 使用中文，客观、精炼、结构化，可直接展示给用户。"
)

SEARCH_ANSWER_SYSTEM_PROMPT = (
    "你是研枢（YanShu）科研平台的检索综合助手。\n"
    "用户提出了一个科研问题，下方是 scout 智能体检索到的候选论文列表（含标题、作者、年份、"
    "来源、CCF 级别、引用数与摘要）。请基于这些检索结果给出一份结构清晰的综合回答：\n"
    "\n"
    "1. 开头用 2~4 句直接回答用户的提问（总结/结论）；\n"
    "2. 然后分点展开，每篇论文用「编号. **标题**（作者, 年份）」开头，附来源、引用数与一句关键评价；\n"
    "3. 若检索结果不足，如实说明并建议调整关键词；\n"
    "4. 只依据下方论文信息作答，严禁编造论文中不存在的内容；\n"
    "5. 使用中文与 Markdown 排版，不要输出任何内部状态信息。"
)


class SynthesisAgent(BaseAgent):
    name = "synthesis"

    def __init__(self, llm: LLMProvider) -> None:
        super().__init__(llm)
        self.system_prompt = SYSTEM_PROMPT

    @staticmethod
    def _clean_question(query: str) -> str:
        for marker in ("我的问题是：", "我的问题是:"):
            if marker in query:
                return query.split(marker, 1)[-1].strip()
        return query.strip()

    @staticmethod
    def _paper_context(pid: str) -> str:
        paper = backend.get_paper(pid) or {}
        title = paper.get("title") or pid
        venue = paper.get("venue") or "未知来源"
        year = paper.get("year") or "未知年份"
        keywords = "、".join(paper.get("keywords") or [])
        abstract = (paper.get("abstract") or "").strip()
        if abstract:
            return abstract
        parts = [f"论文《{title}》发表于 {venue} {year}。"]
        if keywords:
            parts.append(f"关键词包括：{keywords}。")
        parts.append("当前库中缺少完整摘要，以下研读基于题名、发表信息、关键词与可用证据生成。")
        return "".join(parts)

    @staticmethod
    def _usable_text(text: str | None) -> str:
        text = (text or "").strip()
        return "" if text in {"（无摘要）", "(无摘要)", "暂无摘要"} else text

    @staticmethod
    def _evidence_snippet(item: dict, limit: int = 240) -> str:
        snippet = (item.get("text") or "").strip().replace("\n", " ")
        if len(snippet) > limit:
            snippet = snippet[:limit].rstrip() + "..."
        return snippet

    def _run_search_answer(self, state: dict) -> dict:
        """轻量综合模式（task_type=paper_search）：基于 scout 的检索结果直接生成综合回答。

        不逐篇精读 PDF（不做结构化抽取），仅用检索到的论文元信息 + 摘要做一次
        LLM 综合，速度远快于深度研读，适用于发现页/AI 助手的开放式检索问答。
        """
        query = state["user_query"]
        wm = state.get("working_memory") or {}
        outputs = wm.get("agent_outputs") or {}
        scout_out = outputs.get("scout") or {}
        papers = list(scout_out.get("retrieved_papers") or [])

        # 兜底：scout 输出缺失时按证据链从数据后端取论文
        if not papers:
            ev = wm.get("evidence_chain_index") or {}
            papers = [backend.get_paper(pid) for pid in (ev.get("paper_ids") or [])]
            papers = [p for p in papers if p]

        if not papers:
            result = {
                "status": "SUCCESS",
                "structured_elements": {},
                "qa_response": "未检索到相关论文。建议更换关键词，或开启 Ollama 语义检索后重试。",
                "mode": "search_summary",
            }
            wm = self.remember(state, "synthesize answer", result)
            return {"last_output": result, "working_memory": wm}

        paper_list = [
            {
                "index": index + 1,
                "title": p.get("title") or p.get("paper_id") or "Untitled",
                "authors": p.get("author") or "未知作者",
                "year": p.get("year") or "",
                "venue": (p.get("evidence_snippet") or p.get("venue") or "") or "arXiv",
                "ccf": p.get("ccf") or "",
                "citations": int(p.get("citation_count", 0) or 0),
                "abstract": self._evidence_snippet(p, 200),
            }
            for index, p in enumerate(papers[:10])
        ]

        if self.mock:
            lines = [f"针对「{query}」，共检索到 {len(paper_list)} 篇候选论文："]
            for item in paper_list:
                lines.append(
                    f"{item['index']}. **{item['title']}**（{item['authors']}，{item['year']}）"
                    f" — {item['venue']}，引用 {item['citations']}"
                )
            answer = "\n".join(lines)
        else:
            answer = self.llm.complete(
                SEARCH_ANSWER_SYSTEM_PROMPT,
                {"question": query, "papers": paper_list},
                QAAnswer,
            ).answer

        result = {
            "status": "SUCCESS",
            "structured_elements": {},
            "qa_response": answer,
            "mode": "search_summary",
            "retrieved_papers": papers[:10],
        }
        paper_ids = [p.get("paper_id") or p.get("id", "") for p in papers[:10]]
        wm = self.remember(state, "synthesize answer", result, paper_ids=paper_ids)
        return {"last_output": result, "working_memory": wm}

    def _build_qa_answer(self, state: dict, question: str, plan: SynthesisPlan,
                         analyses: dict[str, dict], elements: StructuredElements,
                         evidence_all: list[dict], page_note: str) -> str:
        """生成回答用户问题的 qa_response（专门的一步生成）。

        - 真实模式：LLM 严格依据证据片段 + 结构化分析作答，标注 chunk_id/页码，禁止编造；
        - mock 模式：由实际检索到的证据片段 + 结构化分析拼装，避免模板 FAQ。
        """
        history = state.get("history") or []
        qa_payload = {
            "question": question,
            "history": history[-8:],
            "papers": {pid: (analyses.get(pid) or {}) for pid in plan.paper_ids},
            "structured_elements": elements.model_dump(),
            "evidence": evidence_all[:6],
        }
        if self.mock:
            return self._mock_qa_answer(question, plan, evidence_all, analyses, page_note)
        return self.llm.complete(QA_SYSTEM_PROMPT, qa_payload, QAAnswer).answer

    def _mock_qa_answer(self, question: str, plan: SynthesisPlan, evidence_all: list[dict],
                        analyses: dict[str, dict], page_note: str) -> str:
        """mock 模式兜底：用实际证据与结构化分析拼装回答，而不是固定 FAQ 模板。"""
        lines = [f"已基于证据链中 {len(plan.paper_ids)} 篇论文的证据回答你的问题：「{question}」。"]
        if evidence_all:
            lines.append("\n**直接证据片段**")
            for item in evidence_all[:5]:
                pid = item.get("paper_id", "")
                page = item.get("page", "?")
                cid = item.get("chunk_id", "")
                lines.append(f"- [{pid}·第{page}页·{cid}] {self._evidence_snippet(item)}")
        for pid, analysis in analyses.items():
            innovation = self._usable_text(analysis.get("core_innovation", {}).get("content"))
            methodology = self._usable_text(analysis.get("methodology", {}).get("content"))
            experiments = self._usable_text(analysis.get("experiments", {}).get("content"))
            limitations = self._usable_text(analysis.get("limitations", {}).get("content"))
            lines.append(f"\n**{pid} 结构化分析**")
            if innovation:
                lines.append(f"- 核心创新：{innovation}")
            if methodology:
                lines.append(f"- 方法要点：{methodology}")
            if experiments:
                lines.append(f"- 实验与结果：{experiments}")
            if limitations:
                lines.append(f"- 局限与挑战：{limitations}")
        if page_note and page_note != "无":
            lines.append(f"\n关键证据位置：{page_note}")
        return "\n".join(lines)

    def run(self, state: dict) -> dict:
        query = state["user_query"]

        # 轻量综合模式：paper_search 意图下基于 scout 检索结果直接回答（不做逐篇精读）
        task_type = (state.get("intent") or {}).get("task_type", "")
        if task_type == "paper_search":
            return self._run_search_answer(state)

        # 论文定位顺序：显式 paper_id > 证据链 > 题名/查询启发式 > 库内第一篇
        paper_ids: list[str] = []
        explicit_pid = state.get("paper_id")
        if explicit_pid and backend.get_paper(explicit_pid):
            paper_ids = [explicit_pid]
        if not paper_ids:
            ev = (state.get("working_memory") or {}).get("evidence_chain_index") or {}
            paper_ids = ev.get("paper_ids") or []
        if not paper_ids:
            paper_ids = [p["paper_id"] for p in backend.papers if p.get("paper_id") and p["paper_id"] in query]
        if not paper_ids:
            lower = query.lower()
            paper_ids = [
                p["paper_id"] for p in backend.papers
                if p.get("title") and p.get("title", "").lower() in lower
            ][:1]
        if not paper_ids and backend.papers:
            paper_ids = [backend.papers[0]["paper_id"]]

        # 阶段1. LLM 规划：从证据链中选择要精读的论文与抽取要素（mock 回显确定性计划）
        plan: SynthesisPlan = self.generate(
            {"user_query": query, "available_papers": paper_ids},
            SynthesisPlan,
            {
                "paper_ids": paper_ids,
                "extraction_schema": ["core_innovation", "methodology", "experimental_results", "key_challenges"],
            },
        )

        # 阶段2. 工具执行：解析 PDF + 按问题做混合证据检索（BM25+TF-IDF+RRF），产出页码锚点
        from research_assistant.tools.evidence import build_structured_analysis  # noqa: PLC0415

        evidence_all: list[dict] = []
        analyses: dict[str, dict] = {}
        for pid in plan.paper_ids:
            parsed = tools.call("pdf_parser", paper_id=pid)
            chunks = parsed.get("chunks", [])
            if chunks:
                analyses[pid] = build_structured_analysis(chunks)
            ev_hits = tools.call("evidence_retrieve", paper_id=pid, question=query, limit=3).get("evidence", [])
            for item in ev_hits:
                item["paper_id"] = pid
                evidence_all.append(item)
        evidence_all.sort(key=lambda e: -e.get("rrf_score", 0))
        target_chunks = [e["chunk_id"] for e in evidence_all[:6]]
        anchors = [f"{e.get('paper_id', '')}·第{e['page']}页·{e['chunk_id']}" for e in evidence_all[:3]]

        # 阶段3. 要素抽取 + 结构重组：用检索到的证据构建结构化要素（含页码溯源）
        first = evidence_all[0] if evidence_all else {}
        first_text = first.get("text", "")
        if not first_text or first_text == "（无摘要）":
            first_text = self._paper_context(plan.paper_ids[0]) if plan.paper_ids else ""
        question = self._clean_question(query)
        comparison_table = "\n".join(
            f"| {pid} | 创新点 | 实验设计 | 结论 |" for pid in plan.paper_ids
        )
        elements = StructuredElements(
            summary=f"对 {len(plan.paper_ids)} 篇论文进行结构化精读，回答问题：「{question}」。",
            core_innovation=AnchoredText(
                text=first_text,
                anchor_bbox=None,
                chunk_id=first.get("chunk_id"),
            ),
            methodology="\n\n".join(
                f"### {pid}\n{self._usable_text(a.get('methodology', {}).get('content')) or self._paper_context(pid)}"
                for pid, a in analyses.items()
            ) or "\n\n".join(f"### {pid}\n{self._paper_context(pid)}" for pid in plan.paper_ids) or "## 方法\n暂无足够证据。",
            experimental_results=f"## 实验\n跨文档对比表：\n{comparison_table}",
            key_challenges="\n\n".join(
                f"### {pid}\n{self._usable_text(a.get('limitations', {}).get('content')) or '建议重点核查论文是否报告强基线、消融实验、泛化设置和失败案例。'}"
                for pid, a in analyses.items()
            ) or "## 局限\n建议重点核查论文是否报告强基线、消融实验、泛化设置和失败案例。",
        )
        page_note = "、".join(anchors) or "无"
        # 阶段4. 问答生成：单独一步，只依据证据与结构化分析回答用户问题（见 _build_qa_answer）
        qa_answer = self._build_qa_answer(state, question, plan, analyses, elements, evidence_all, page_note)
        draft = {
            "status": "SUCCESS",
            "structured_elements": elements.model_dump(),
            "qa_response": qa_answer,
        }
        payload = {
            "query": query,
            "plan": plan.model_dump(),
            "target_chunks": target_chunks,
            "evidence": evidence_all[:6],
            "extracted_elements": elements.model_dump(),
        }
        output: SynthesisOutput = self.generate(payload, SynthesisOutput, draft)
        # 问答回复以专门问答步骤的结果为准，覆盖通用生成可能不基于证据的内容
        output.qa_response = qa_answer
        result = output.model_dump() | {"target_chunks": target_chunks, "evidence": evidence_all[:6]}
        wm = self.remember(state, "read & structure papers", result, paper_ids=list(plan.paper_ids))
        return {"last_output": result, "working_memory": wm}
