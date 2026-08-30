"""外部知识服务集成。"""

from research_assistant.integrations.retrieval_client import (
    KnowledgeBaseClient,
    KnowledgeBaseError,
    client,
)

__all__ = ["KnowledgeBaseClient", "KnowledgeBaseError", "client"]
