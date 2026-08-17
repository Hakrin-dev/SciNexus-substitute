from research_assistant.agents.base import BaseAgent
from research_assistant.agents.code_assistant import CodeAssistantAgent
from research_assistant.agents.critic import CriticAgent
from research_assistant.agents.librarian import LibrarianAgent
from research_assistant.agents.research_design import ResearchDesignAgent
from research_assistant.agents.scout import ScoutAgent
from research_assistant.agents.synthesis import SynthesisAgent
from research_assistant.agents.writer import WriterAgent
from research_assistant.llm import LLMProvider, get_llm

ALL_AGENTS: dict[str, type[BaseAgent]] = {
    "scout": ScoutAgent,
    "synthesis": SynthesisAgent,
    "librarian": LibrarianAgent,
    "research_design": ResearchDesignAgent,
    "code_assistant": CodeAssistantAgent,
    "writer": WriterAgent,
    "critic": CriticAgent,
}


def build_agents(llm: LLMProvider | None = None) -> dict[str, BaseAgent]:
    llm = llm or get_llm()
    return {name: cls(llm) for name, cls in ALL_AGENTS.items()}


__all__ = ["BaseAgent", "ALL_AGENTS", "build_agents", "get_llm"]
