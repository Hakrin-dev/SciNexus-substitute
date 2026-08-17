"""LangGraph 工作流组装：Supervisor 控制节点 + 受控 agent 执行循环。"""
from __future__ import annotations

from langgraph.graph import END, START, StateGraph
from langgraph.checkpoint.memory import InMemorySaver

from research_assistant.agents import build_agents
from research_assistant.llm import LLMProvider
from research_assistant.state import WorkflowState
from research_assistant.supervisor import Supervisor, finalize_node, route_edge
from research_assistant.tools import tools

AGENT_NODES = ["scout", "synthesis", "librarian", "research_design", "code_assistant", "writer", "critic"]


def _controlled_agent_node(name: str, agent):
    """执行 agent 时强制实施 Supervisor 在当前步骤授予的工具白名单。"""
    def run(state: dict) -> dict:
        plan = state.get("task_plan") or []
        index = state.get("plan_index") or 0
        allowed_tools = plan[index].get("authorized_tools", []) if index < len(plan) else []
        try:
            with tools.authorized_for(name, allowed_tools):
                return agent.run(state)
        except Exception as exc:
            # 不让底层异常逃离状态机，统一交由 Supervisor 分类并决定重试、跳过或阻断。
            output = {"status": "FAILED", "reason": f"{type(exc).__name__}: {exc}"}
            wm = dict(state.get("working_memory") or {})
            session = list(wm.get("session_context") or [])
            session.append({"agent": name, "action": "execution_exception", "result": output})
            outputs = dict(wm.get("agent_outputs") or {})
            outputs[name] = output
            wm["session_context"] = session
            wm["agent_outputs"] = outputs
            return {"last_output": output, "working_memory": wm}
    return run


def build_graph(llm: LLMProvider | None = None, supervisor_llm: LLMProvider | None = None,
                checkpoint: bool = True):
    agents = build_agents(llm)
    supervisor = Supervisor(supervisor_llm)

    graph = StateGraph(WorkflowState)

    # Supervisor（全局中枢）节点
    graph.add_node("supervisor", supervisor.run)
    graph.add_node("finalize", finalize_node)

    # 七个智能体节点
    for name in AGENT_NODES:
        graph.add_node(name, _controlled_agent_node(name, agents[name]))

    graph.add_edge(START, "supervisor")

    # 每个 agent 都回到 Supervisor，由控制节点处理状态推进与异常恢复。
    for name in AGENT_NODES:
        graph.add_edge(name, "supervisor")
    graph.add_conditional_edges(
        "supervisor", route_edge, {name: name for name in AGENT_NODES} | {"finalize": "finalize"}
    )

    graph.add_edge("finalize", END)

    checkpointer = InMemorySaver() if checkpoint else None
    return graph.compile(checkpointer=checkpointer)
