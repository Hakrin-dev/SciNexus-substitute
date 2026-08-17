"""全局工作记忆与 LangGraph 图状态。"""
from __future__ import annotations

from typing import Any, TypedDict


class TaskState(TypedDict, total=False):
    task_id: str
    current_agent: str
    status: str  # running | done | failed


class EvidenceChainIndex(TypedDict, total=False):
    paper_ids: list[str]
    chunk_index: dict[str, list[str]]  # paper_id -> chunk_ids


class WorkingMemory(TypedDict, total=False):
    """Global Working Memory：会话上下文 / 学术证据链索引 / 任务状态。"""
    session_context: list[dict[str, Any]]  # 用户交互与 agent 间交流记录
    evidence_chain_index: EvidenceChainIndex
    task_state: TaskState
    # 各 agent 产生的中间产物（按 agent 名索引）
    agent_outputs: dict[str, dict[str, Any]]


class WorkflowState(TypedDict, total=False):
    user_query: str
    paper_id: str | None  # 用户显式指定的论文 ID（论文问答/阅读场景）
    history: list[dict[str, str]]  # 对话历史 [{role, content}]，供 agent 保持上下文
    raw_input: dict[str, Any]
    intent: dict[str, Any]
    task_plan: list[dict[str, Any]]
    plan_index: int
    current_agent: str
    # Supervisor 对当前任务步骤授予的工具权限（仅供审计；运行时由图节点执行）。
    tool_authorizations: dict[str, list[str]]
    last_output: dict[str, Any]
    working_memory: WorkingMemory
    errors: list[dict[str, str]]
    recovery: dict[str, int]
    final_response: str
