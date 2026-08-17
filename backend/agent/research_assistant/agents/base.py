"""智能体基类：统一 system prompt + 工具调用 + 结构化输出。"""
from __future__ import annotations

from abc import ABC, abstractmethod

from pydantic import BaseModel

from research_assistant.llm import LLMProvider, MockProvider


class BaseAgent(ABC):
    """所有智能体继承本类。

    - system_prompt: 设计文档中定义的 agent 系统提示词
    - generate(): 统一入口——mock 模式回显占位数据；真实模式调用 LLM 结构化生成
    - run(): 接收 LangGraph 状态，返回对状态的增量更新
    """

    name: str = "base"
    system_prompt: str = ""

    def __init__(self, llm: LLMProvider) -> None:
        self.llm = llm

    @property
    def mock(self) -> bool:
        return isinstance(self.llm, MockProvider)

    def complete(self, user_payload: dict, output_model: type[BaseModel]) -> BaseModel:
        return self.llm.complete(self.system_prompt, user_payload, output_model)

    def generate(self, user_payload: dict, output_model: type[BaseModel], mock_data: dict) -> BaseModel:
        """生成符合 output_model 的输出。

        - mock 模式：直接回显 mock_data（等价于之前的占位实现）
        - 真实模式：将 user_payload（含 query 与工具检索上下文）交给 LLM 按 schema 生成
        """
        if self.mock:
            return output_model(**mock_data)
        return self.complete(user_payload, output_model)

    # ------------------------------------------------------------------ #
    # 工作记忆合并辅助
    # ------------------------------------------------------------------ #
    def remember(self, state: dict, action: str, result: dict, paper_ids: list[str] | None = None) -> dict:
        """读取并合并 Global Working Memory，避免各 agent 覆盖彼此产物。"""
        wm = dict(state.get("working_memory") or {})
        session = list(wm.get("session_context") or [])
        session.append({"agent": self.name, "action": action, "result": result})

        ev = dict(wm.get("evidence_chain_index") or {})
        if paper_ids is not None:
            ev["paper_ids"] = list(dict.fromkeys((ev.get("paper_ids") or []) + paper_ids))

        outputs = dict(wm.get("agent_outputs") or {})
        outputs[self.name] = result

        wm.update(
            {
                "session_context": session,
                "evidence_chain_index": ev,
                "agent_outputs": outputs,
                "task_state": {"task_id": state.get("intent", {}).get("task_id", ""),
                               "current_agent": self.name, "status": "running"},
            }
        )
        return wm

    @abstractmethod
    def run(self, state: dict) -> dict:
        """执行该 agent 逻辑，返回对 LangGraph 状态的增量更新。"""
