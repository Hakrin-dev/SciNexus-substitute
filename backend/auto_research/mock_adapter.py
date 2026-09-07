from __future__ import annotations

from typing import Any

from .protocol import StageOutput

LABELS = {
    "plan": "研究计划",
    "search": "模拟检索",
    "read": "模拟阅读",
    "synthesize": "证据综合",
    "design": "实验设计",
    "code": "实验代码",
    "run": "实验运行",
    "report": "研究报告",
}


class MockResearchAdapter:
    """Deterministic adapter used to verify the platform workflow without external APIs."""

    name = "mock-adapter"
    execution_mode = "mock"

    def execute_stage(
        self,
        stage: str,
        objective: str,
        context: dict[str, Any],
    ) -> StageOutput:
        label = LABELS[stage]
        instructions = str(context.get("instructions") or "").strip()
        instruction_note = f"\n\n本阶段已应用追加指令：{instructions}" if instructions else ""

        if stage == "code":
            content = "print('mock experiment passed')\n"
        elif stage == "run":
            content = '{"accuracy": 0.8, "mode": "mock"}'
        elif stage == "report":
            content = (
                "# 模拟研究报告\n\n"
                f"## 研究目标\n\n{objective}\n\n"
                "## 运行结论\n\n平台已完成八阶段闭环；本报告仅验证交互、队列、资产和报告投影，"
                "不代表真实文献检索或实验结论。\n"
                f"{instruction_note}\n"
            )
        else:
            content = (
                f"# {label}\n\n围绕“{objective}”生成的模拟阶段产物，"
                f"仅用于平台验收。{instruction_note}\n"
            )

        artifact_kind = (
            "report" if stage == "report" else
            "code" if stage == "code" else
            "metrics" if stage == "run" else
            "note"
        )
        return StageOutput(
            stage=stage,
            title=label,
            summary=f"{label}已完成（模拟运行）",
            artifact_kind=artifact_kind,
            content=content,
            metadata={"executionMode": self.execution_mode, "adapter": self.name},
        )
