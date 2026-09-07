from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any, Protocol

STAGES = ("plan", "search", "read", "synthesize", "design", "code", "run", "report")

@dataclass(frozen=True)
class StageOutput:
    stage: str
    title: str
    summary: str
    artifact_kind: str = "note"
    content: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)

class ResearchAdapter(Protocol):
    name: str
    execution_mode: str
    def execute_stage(self, stage: str, objective: str, context: dict[str, Any]) -> StageOutput: ...
