"""Supervisor 控制平面：LLM 规划、状态机控制、工具授权与异常恢复。"""
from __future__ import annotations

import uuid
from typing import Any

from research_assistant.config import settings
from research_assistant.llm import LLMProvider, MockProvider, get_supervisor_llm
from research_assistant.schemas import SupervisorDecision, SupervisorStep

# 意图 -> 路由计划（对应设计文档模块二~八）
INTENT_TABLE: dict[str, dict] = {
    "paper_search": {
        "description": "智能论文搜索",
        "required_agents": ["scout"],
        "steps": [{"agent": "scout", "action": "retrieve papers"}],
    },
    "similar_papers": {
        "description": "相似论文查询",
        "required_agents": ["scout", "librarian"],
        "steps": [
            {"agent": "scout", "action": "retrieve papers"},
            {"agent": "librarian", "action": "build research graph"},
        ],
    },
    "ai_reading": {
        "description": "AI 辅助论文阅读",
        "required_agents": ["synthesis"],
        "steps": [{"agent": "synthesis", "action": "read & structure papers"}],
    },
    "research_exploration": {
        "description": "科研探索",
        "required_agents": ["scout", "librarian"],
        "steps": [
            {"agent": "scout", "action": "retrieve papers"},
            {"agent": "librarian", "action": "build research graph"},
        ],
    },
    "autonomous_research": {
        "description": "自主科研全流程",
        "required_agents": ["scout", "librarian", "research_design", "code_assistant", "writer", "critic"],
        "steps": [
            {"agent": "scout", "action": "retrieve papers"},
            {"agent": "librarian", "action": "build research graph"},
            {"agent": "research_design", "action": "generate proposal"},
            {"agent": "code_assistant", "action": "generate experiment code"},
            {"agent": "writer", "action": "write paper draft"},
            {"agent": "critic", "action": "review paper & match venue"},
        ],
    },
    "code_generation": {
        "description": "科研代码生成与算法复现",
        "required_agents": ["code_assistant"],
        "steps": [{"agent": "code_assistant", "action": "generate reproducible code files"}],
    },
    "ai_writing": {
        "description": "AI 辅助科研撰写",
        "required_agents": ["writer", "critic"],
        "steps": [
            {"agent": "writer", "action": "write paper draft"},
            {"agent": "critic", "action": "review paper"},
        ],
    },
    "literature_review": {
        "description": "文献综述生成",
        "required_agents": ["scout", "writer", "critic"],
        "steps": [
            {"agent": "scout", "action": "retrieve review evidence"},
            {"agent": "writer", "action": "write literature review file"},
            {"agent": "critic", "action": "review citations and structure"},
        ],
    },
    "submission": {
        "description": "论文投稿",
        "required_agents": ["critic"],
        "steps": [{"agent": "critic", "action": "venue matching analysis"}],
    },
    "library_management": {
        "description": "个人文献库管理",
        "required_agents": ["librarian"],
        "steps": [{"agent": "librarian", "action": "manage personal literature library"}],
    },
}

# 关键词 -> 意图
KEYWORD_RULES: list[tuple[list[str], str]] = [
    (["投稿", "投到", "投递", "会议匹配", "期刊", "发表到", "投稿方案"], "submission"),
    (["自主科研", "自动科研", "全流程", "一键科研"], "autonomous_research"),
    (["代码", "实现", "复现", "算法伪代码", "pytorch", "python", "训练脚本", "生成文件"], "code_generation"),
    (["文献综述", "综述"], "literature_review"),
    (["相似论文", "对比", "赛道", "同方向", "区别", "差异对比"], "similar_papers"),
    (["阅读", "精读", "解读", "讲解", "总结这篇", "问答"], "ai_reading"),
    (["研究趋势", "科研探索", "探索", "前沿", "热点", "研究方向", "gap"], "research_exploration"),
    (["写论文", "撰写", "初稿", "改论文", "写作", "latex"], "ai_writing"),
    (["文献库", "管理", "归档", "图谱", "整理", "私域"], "library_management"),
    (["搜索", "检索", "查找", "找论文", "查询"], "paper_search"),
    # ---- 英文意图（中文规则之后，避免抢占中文匹配）----
    (["autonomous", "full pipeline", "end-to-end"], "autonomous_research"),
    (["code", "implement", "implementation", "reproduce", "pytorch", "python", "training script"], "code_generation"),
    (["literature review", "survey paper", "related work survey"], "literature_review"),
    (["submission", "venue matching", "publish", "journal", "target conference"], "submission"),
    (["similar papers", "related work", "comparison", "compare", "difference"], "similar_papers"),
    (["summarize", "summarise", "read this paper", "explain", "parse", "qa", "understand paper"], "ai_reading"),
    (["research trend", "trend analysis", "frontier", "research direction", "hot topic", "gap analysis", "explore"], "research_exploration"),
    (["write paper", "draft paper", "write a paper", "polish", "revise", "latex paper"], "ai_writing"),
    (["my library", "organize", "manage papers", "folder"], "library_management"),
    (["search", "find papers", "query", "retrieve", "look for", "find"], "paper_search"),
]

DEFAULT_INTENT = "paper_search"

# mock 路径的离线授权数据。真实路径由 Supervisor LLM 在受约束 schema 内生成。
MOCK_AGENT_TOOLS: dict[str, list[str]] = {
    "scout": ["vector_rag", "graph_rag"],
    "synthesis": ["pdf_parser", "evidence_retrieve"],
    "librarian": ["graph_expand"],
    "research_design": [],
    "code_assistant": [],
    "writer": ["pdf_parser", "dpo_align"],
    "critic": ["venue_db", "evidence_check"],
}

SUPERVISOR_PROMPT = """你是科研助手的 Supervisor 控制平面，不执行任何科研子任务。
你的职责：基于用户请求与全局工作记忆，输出一个**最小、可执行**的 agent 执行计划。

【决策原则】
- 只执行用户当前明确请求的任务，不要自动扩展执行范围。
- 优先选择最少数量的 agent 完成请求；仅当请求明显需要组合多个步骤时，才按上游依赖串联 agent。
- 判断不清或意图模糊时，选择代价最小的动作，不要扩大范围。
- 不要生成重复或无意义的步骤。

【工具授权】
每个步骤必须声明该 agent 完成本步骤实际需要的最小工具集；可用工具只有：
vector_rag、graph_rag、pdf_parser、graph_expand、venue_db、evidence_check、dpo_align、evidence_retrieve、pdf_ingest。
各 agent 硬编码依赖的最小工具集（授权时必须包含，否则该 agent 会因缺少工具而执行失败）：
- scout: vector_rag, graph_rag
- synthesis: pdf_parser, evidence_retrieve
- librarian: graph_expand
- research_design: （无需工具）
- code_assistant: （无需工具）
- writer: pdf_parser, dpo_align
- critic: venue_db, evidence_check

【收敛示例】
用户："帮我搜索 transformer 相关的论文"
避免（scope 过大，多调用 agent）：
  scout, librarian, research_design, writer, critic   # ❌ 用户只需检索
倾向（最小执行）：
  scout(action="retrieve papers")                      # ✅

用户："帮我写一篇关于联邦学习的综述"
避免（缺少上游证据）：
  writer, critic                                      # ❌ 综述必须先生成证据
倾向（按依赖串联）：
  scout(retrieve evidence), writer(write literature review), critic(review citations)  # ✅

【自主科研模式（重要）】
task_type=autonomous_research 表示「自主科研模式」，但**绝不等于必须跑满全部 agent**。
请根据用户 query 的实际需求，只选择完成该请求真正需要的 agent：
- 分析/趋势类（如「ai发展分析」「xx研究现状」）→ scout + librarian + writer，无需 code_assistant / research_design / critic；
- 代码复现类（如「帮我复现 xx 算法」）→ scout + code_assistant；
- 只有「从检索到成文到审稿的全流程」才按上游依赖串联全部 agent。

按上游依赖排序步骤。只返回符合给定 JSON Schema 的结果。"""


def recognize_intent(user_query: str) -> dict:
    """意图识别（mock：关键词规则）。返回 {task_type, required_agents, description}。"""
    for keywords, task_type in KEYWORD_RULES:
        if any(k in user_query for k in keywords):
            info = INTENT_TABLE[task_type]
            return {
                "task_type": task_type,
                "required_agents": info["required_agents"],
                "description": info["description"],
            }
    info = INTENT_TABLE[DEFAULT_INTENT]
    return {
        "task_type": DEFAULT_INTENT,
        "required_agents": info["required_agents"],
        "description": info["description"],
    }


def build_task_plan(task_type: str) -> list[dict]:
    info = INTENT_TABLE[task_type]
    return [
        {"step": i + 1, "agent": s["agent"], "action": s["action"]}
        for i, s in enumerate(info["steps"])
    ]


def _mock_decision(query: str) -> dict[str, Any]:
    """只供 MockProvider 使用的确定性控制决策。"""
    intent = _forced_intent(query) or recognize_intent(query)
    return {
        "task_type": intent["task_type"],
        "description": intent["description"],
        "steps": [
            {
                "agent": step["agent"],
                "action": step["action"],
                "authorized_tools": MOCK_AGENT_TOOLS[step["agent"]],
            }
            for step in build_task_plan(intent["task_type"])
        ],
    }


def forced_decision(task_type: str) -> dict[str, Any]:
    """按前端显式模块意图生成受设计文档约束的执行计划。"""
    info = INTENT_TABLE[task_type]
    return {
        "task_type": task_type,
        "description": info["description"],
        "steps": [
            {
                "agent": step["agent"],
                "action": step["action"],
                "authorized_tools": MOCK_AGENT_TOOLS[step["agent"]],
            }
            for step in info["steps"]
        ],
    }


def _forced_intent(task_type: str | None) -> dict[str, Any] | None:
    if not task_type or task_type not in INTENT_TABLE:
        return None
    info = INTENT_TABLE[task_type]
    return {"task_type": task_type, "required_agents": info["required_agents"], "description": info["description"]}


def _constrained_steps(raw_steps: list[dict]) -> list[SupervisorStep]:
    """按 agent 最小工具集构建受约束步骤；未知 agent 兜底为空工具集。"""
    return [
        SupervisorStep(
            agent=step["agent"],
            action=step["action"],
            authorized_tools=list(MOCK_AGENT_TOOLS.get(step["agent"], [])),
        )
        for step in raw_steps
    ]


def constrain_decision(decision: SupervisorDecision, user_query: str) -> SupervisorDecision:
    """模块级 agent 白名单硬约束：即使 LLM 出错，也不允许把模块路由到白名单外的 agent。

    task_type 以 decision 为准（须为 INTENT_TABLE 键），否则回退到意图识别；
    agent 集合与最小工具集由设计文档决定，LLM 仅在模块内保留步骤子集与顺序的建议权。
    """
    if decision.task_type in INTENT_TABLE:
        task_type = decision.task_type
    else:
        task_type = recognize_intent(user_query)["task_type"]
    allowed = set(INTENT_TABLE[task_type]["required_agents"])

    filtered_steps = _constrained_steps(
        [{"agent": step.agent, "action": step.action} for step in decision.steps if step.agent in allowed]
    )
    if not filtered_steps:
        filtered_steps = _constrained_steps(INTENT_TABLE[task_type]["steps"])
    return SupervisorDecision(
        task_type=task_type,
        description=INTENT_TABLE[task_type]["description"],
        steps=filtered_steps,
    )


class Supervisor:
    """状态机控制节点。

    同一节点负责初始的 LLM 规划，以及每个 agent 结束后的状态推进、异常分类和恢复。
    """

    max_retries = 1

    def __init__(self, llm: LLMProvider | None = None) -> None:
        self.llm = llm or get_supervisor_llm()

    def run(self, state: dict) -> dict:
        if not state.get("intent"):
            return self._start_task(state)
        return self._control_after_agent(state)

    def _start_task(self, state: dict) -> dict:
        query = state["user_query"]
        explicit_task_type = (state.get("raw_input") or {}).get("task_type")
        payload: dict[str, Any] = {
            "user_query": query,
            "working_memory": state.get("working_memory") or {},
            "current_task_state": (state.get("working_memory") or {}).get("task_state") or {},
        }
        if explicit_task_type and _forced_intent(str(explicit_task_type)) is not None \
                and str(explicit_task_type) != "autonomous_research":
            decision = SupervisorDecision(**forced_decision(str(explicit_task_type)))
        else:
            if isinstance(self.llm, MockProvider):
                payload["_mock_data"] = _mock_decision(query)

            try:
                decision = self.llm.complete(SUPERVISOR_PROMPT, payload, SupervisorDecision)
            except Exception as exc:
                return self._planning_failure(state, exc)

        if settings.supervisor_enforce_allowlist:
            decision = constrain_decision(decision, query)

        task_id = f"task-{uuid.uuid4().hex[:8]}"
        plan = [
            {
                "step": index,
                "agent": step.agent,
                "action": step.action,
                "authorized_tools": list(step.authorized_tools),
            }
            for index, step in enumerate(decision.steps, start=1)
        ]
        required_agents = list(dict.fromkeys(step["agent"] for step in plan))
        intent = {
            "task_id": task_id,
            "task_type": decision.task_type,
            "description": decision.description,
            "required_agents": required_agents,
        }
        authorizations = {step["agent"]: step["authorized_tools"] for step in plan}
        wm = dict(state.get("working_memory") or {})
        session = list(wm.get("session_context") or [])
        session.append(
            {
                "agent": "supervisor",
                "action": "llm_plan_and_tool_authorization",
                "result": {"task_type": decision.task_type, "plan": plan, "authorizations": authorizations},
            }
        )
        wm["session_context"] = session
        wm["task_state"] = {"task_id": task_id, "current_agent": plan[0]["agent"], "status": "running"}
        return {
            "intent": intent,
            "task_plan": plan,
            "tool_authorizations": authorizations,
            "plan_index": 0,
            "current_agent": plan[0]["agent"],
            "working_memory": wm,
            "errors": [],
            "recovery": {},
        }

    def _planning_failure(self, state: dict, exc: Exception) -> dict:
        """规划模型不可用时阻断任务，绝不静默回退到硬编码路由。"""
        wm = dict(state.get("working_memory") or {})
        session = list(wm.get("session_context") or [])
        error = {"agent": "supervisor", "category": "planning_failure", "detail": str(exc)}
        session.append({"agent": "supervisor", "action": "planning_failure", "result": error})
        wm["session_context"] = session
        wm["task_state"] = {"task_id": "", "current_agent": "", "status": "failed"}
        return {"task_plan": [], "current_agent": "", "working_memory": wm, "errors": [error]}

    def _control_after_agent(self, state: dict) -> dict:
        plan = state.get("task_plan") or []
        index = state.get("plan_index") or 0
        if index >= len(plan):
            return {}

        output = state.get("last_output") or {}
        failure = self._detect_failure(output)
        errors = list(state.get("errors") or [])
        recovery = dict(state.get("recovery") or {})
        wm = dict(state.get("working_memory") or {})
        session = list(wm.get("session_context") or [])

        if failure is None:
            next_index = index + 1
            action = "advance"
        elif failure["category"] == "partial_result":
            errors.append(failure)
            next_index = index + 1
            action = "continue_with_partial_result"
        else:
            failure["agent"] = state.get("current_agent", plan[index]["agent"])
            errors.append(failure)
            attempt = int(recovery.get(str(index), 0))
            if failure["category"] == "authorization_denied":
                next_index = len(plan)
                action = "block_for_authorization"
            elif failure["category"] in {"transient_failure", "tool_failure", "llm_output_failure"} and attempt < self.max_retries:
                recovery[str(index)] = attempt + 1
                next_index = index
                action = "retry"
            else:
                next_index = index + 1
                action = "skip_failed_step"

        next_agent = plan[next_index]["agent"] if next_index < len(plan) else ""
        status = "blocked" if action == "block_for_authorization" else ("done" if not next_agent else "running")
        wm["task_state"] = {
            "task_id": (state.get("intent") or {}).get("task_id", ""),
            "current_agent": next_agent,
            "status": status,
        }
        session.append(
            {
                "agent": "supervisor",
                "action": "state_transition",
                "result": {"from_agent": state.get("current_agent", ""), "decision": action, "next_agent": next_agent, "failure": failure},
            }
        )
        wm["session_context"] = session
        return {
            "plan_index": next_index,
            "current_agent": next_agent,
            "working_memory": wm,
            "errors": errors,
            "recovery": recovery,
        }

    @staticmethod
    def _detect_failure(output: dict) -> dict[str, str] | None:
        status = output.get("status")
        if status == "SUCCESS" or not status:
            return None
        if status == "PARTIAL":
            return {"agent": "", "category": "partial_result", "detail": output.get("reason", "agent returned partial result")}
        reason = str(output.get("reason") or output.get("error") or "agent returned FAILED")
        lower = reason.lower()
        if "authorization" in lower or "permission" in lower:
            category = "authorization_denied"
        elif any(token in lower for token in ("timeout", "connection", "temporar", "unavailable")):
            category = "transient_failure"
        elif any(token in lower for token in ("validation", "schema", "json", "parse")):
            category = "llm_output_failure"
        elif "tool" in lower or "unknown" in lower:
            category = "tool_failure"
        else:
            category = "agent_failure"
        return {"agent": "", "category": category, "detail": reason}


def supervisor_node(state: dict) -> dict:
    """兼容直接调用；生产图应复用 ``Supervisor`` 实例。"""
    return Supervisor().run(state)


def _code_assistant_summary(out: dict) -> str:
    """code_assistant 输出摘要（对齐新 schema：generated_artifacts / execution_guide）。"""
    main = (out.get("generated_artifacts") or {}).get("main_code") or {}
    return f"生成代码: {main.get('file_path', '无')}（{main.get('lines_of_code', '?')} 行）"


def _generated_files_markdown(out: dict) -> list[str]:
    files = out.get("generated_files") or []
    if not files:
        return []
    lines = ["", "## 生成文件", "以下文件已生成，可在右侧编辑区预览、修改并导出。"]
    for file in files:
        path = file.get("path", "untitled.txt")
        language = file.get("language", "text")
        content = str(file.get("content", ""))
        lines.extend(["", f"### `{path}`", f"```{language}", content.rstrip(), "```"])
    return lines


def _scout_result_markdown(out: dict, limit: int = 5) -> list[str]:
    papers = out.get("retrieved_papers") or []
    if not papers:
        return ["", "未检索到可展示论文。"]
    lines = ["", "## 检索结果", f"为你筛出 {len(papers)} 篇候选论文，优先阅读："]
    for index, paper in enumerate(papers[:limit], start=1):
        title = paper.get("title") or paper.get("paper_id") or "Untitled"
        author = paper.get("author") or "Unknown authors"
        year = paper.get("year") or ""
        venue = paper.get("evidence_snippet") or paper.get("venue") or ""
        cites = paper.get("citation_count", 0)
        match = paper.get("match_level") or paper.get("match_label") or ""
        abstract = (paper.get("abstract") or "").replace("\n", " ").strip()
        if len(abstract) > 180:
            abstract = abstract[:180].rstrip() + "..."
        lines.append(f"{index}. **{title}** ({author}, {year})")
        lines.append(f"   - 匹配: {match}；来源: {venue or '未知'}；引用: {cites}")
        if abstract:
            lines.append(f"   - 摘要: {abstract}")
    return lines


def _librarian_result_markdown(out: dict, limit: int = 6) -> list[str]:
    graph = out.get("graph_data") or {}
    nodes = graph.get("nodes") or []
    edges = graph.get("edges") or []
    if not nodes:
        return ["", "## 图谱结果", "当前没有足够的种子论文构建图谱。"]
    ordered = sorted(nodes, key=lambda node: node.get("read_priority", 99))
    lines = [
        "",
        "## 知识图谱结果",
        f"已构建 {len(nodes)} 个节点、{len(edges)} 条关系。建议先看这些节点：",
    ]
    for index, node in enumerate(ordered[:limit], start=1):
        lines.append(
            f"{index}. **{node.get('label', node.get('id', '未知节点'))}** "
            f"({node.get('category', 'paper')}，优先级 {node.get('read_priority', '-')})"
        )
    rel_counter: dict[str, int] = {}
    for edge in edges:
        rel = edge.get("relation_type", "related")
        rel_counter[rel] = rel_counter.get(rel, 0) + 1
    if rel_counter:
        rel_text = "；".join(f"{key}: {value}" for key, value in sorted(rel_counter.items()))
        lines.append(f"关系分布：{rel_text}")
    return lines


def _synthesis_result_markdown(out: dict) -> list[str]:
    elements = out.get("structured_elements") or {}
    if not elements:
        return ["", "## 研读结果", out.get("qa_response", "未生成结构化研读结果。")]
    core = elements.get("core_innovation") or {}
    lines = ["", "## 研读结果"]
    if elements.get("summary"):
        lines.append(f"**速读摘要**：{elements['summary']}")
    if core.get("text"):
        lines.append("")
        lines.append(f"**核心创新证据**：{str(core['text']).strip()}")
    if elements.get("methodology"):
        lines.append("")
        lines.append("**方法要点**")
        lines.append(str(elements["methodology"]).strip())
    if elements.get("experimental_results"):
        lines.append("")
        lines.append("**实验与对比**")
        lines.append(str(elements["experimental_results"]).strip())
    if elements.get("key_challenges"):
        lines.append("")
        lines.append("**局限与挑战**")
        lines.append(str(elements["key_challenges"]).strip())
    if out.get("qa_response"):
        lines.append("")
        lines.append(str(out["qa_response"]))
    return lines


def _research_design_result_markdown(out: dict) -> list[str]:
    proposal = out.get("proposal") or {}
    if not proposal:
        return []
    lines = ["", "## 研究方案"]
    for key in ("title", "research_question", "hypothesis"):
        if proposal.get(key):
            lines.append(f"- **{key}**：{proposal[key]}")
    novelty = proposal.get("novelty_analysis") or {}
    if novelty:
        lines.append(f"- **创新性**：{novelty.get('level', '未知')}；{novelty.get('comparison_with_existing_work', '')}")
    exp = proposal.get("experimental_design") or {}
    if exp:
        lines.append("- **实验设计**：" + "；".join(
            f"{k}: {', '.join(v) if isinstance(v, list) else v}" for k, v in exp.items() if v
        ))
    return lines


def _critic_result_markdown(out: dict) -> list[str]:
    report = out.get("review_report") or {}
    if not report:
        return []
    lines = ["", "## 审查结果"]
    if report.get("decision"):
        lines.append(f"- 决策：**{report['decision']}**")
    if report.get("overall_score") is not None:
        lines.append(f"- 综合分：{report['overall_score']}")
    issues = report.get("issues_found") or []
    if issues:
        lines.append("- 主要问题：")
        for issue in issues[:3]:
            lines.append(f"  - {issue.get('type', 'Issue')}：{issue.get('detail', '')}")
    venues = ((report.get("venue_matching_analysis") or {}).get("recommended_venues") or [])
    if venues:
        lines.append("- 推荐投稿目标：" + "、".join(v.get("name", "") for v in venues[:3]))
    return lines


def route_edge(state: dict) -> str:
    """条件边：Supervisor 已写入当前控制状态，此函数只读取状态。"""
    plan = state.get("task_plan") or []
    idx = state.get("plan_index") or 0
    if idx >= len(plan):
        return "finalize"
    return plan[idx]["agent"]


def finalize_node(state: dict) -> dict:
    """收尾节点：从工作记忆汇总最终响应。"""
    wm = state.get("working_memory") or {}
    outputs = wm.get("agent_outputs") or {}
    lines = [f"任务已完成，参与智能体: {state.get('intent', {}).get('required_agents', [])}"]
    for agent, out in outputs.items():
        status = out.get("status", "")
        summary = {
            "scout": f"检索到 {len(out.get('retrieved_papers', []))} 篇论文",
            "synthesis": out.get("structured_elements", {}).get("summary", ""),
            "librarian": f"构建图谱: {len(out.get('graph_data', {}).get('nodes', []))} 节点 / {len(out.get('graph_data', {}).get('edges', []))} 边",
            "research_design": out.get("proposal", {}).get("title", ""),
            "code_assistant": _code_assistant_summary(out),
            "writer": f"生成写作文件: {len(out.get('generated_files') or [])} 个",
            "critic": f"审稿决策: {out.get('review_report', {}).get('decision', '')}",
        }.get(agent, "")
        lines.append(f"[{agent}] {status} - {summary}")
        if status != "SUCCESS":
            continue
        if agent == "scout":
            lines.extend(_scout_result_markdown(out))
        elif agent == "librarian":
            lines.extend(_librarian_result_markdown(out))
        elif agent == "synthesis":
            lines.extend(_synthesis_result_markdown(out))
        elif agent == "research_design":
            lines.extend(_research_design_result_markdown(out))
        elif agent == "critic":
            lines.extend(_critic_result_markdown(out))
        if agent in {"code_assistant", "writer"} and status == "SUCCESS":
            lines.extend(_generated_files_markdown(out))

    errors = state.get("errors") or []
    if errors:
        lines.append(f"警告: {len(errors)} 个 agent 返回失败 -> {errors}")

    task_state = dict(wm.get("task_state") or {})
    if task_state.get("status") != "blocked":
        task_state["status"] = "done"
    wm["task_state"] = task_state
    return {"final_response": "\n".join(lines), "working_memory": wm}
