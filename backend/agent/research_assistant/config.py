"""多智能体科研助手 - 全局配置。"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

# 从项目根目录加载 .env（若存在），优先级低于已设置的环境变量
load_dotenv(Path(__file__).resolve().parent.parent / ".env")


def _default_llm_provider() -> str:
    """LLM provider 默认逻辑：LLM_PROVIDER 显式设置优先；
    否则配置了 OPENAI_API_KEY 时用 openai；否则回退 mock。"""
    if os.getenv("LLM_PROVIDER"):
        return os.getenv("LLM_PROVIDER", "")
    return "openai" if os.getenv("OPENAI_API_KEY") else "mock"


@dataclass
class Settings:
    # llm_provider: mock | openai | ollama
    llm_provider: str = field(default_factory=_default_llm_provider)
    openai_api_key: str = field(default_factory=lambda: os.getenv("OPENAI_API_KEY", ""))
    openai_base_url: str = field(default_factory=lambda: os.getenv("OPENAI_BASE_URL", ""))
    llm_model: str = field(default_factory=lambda: os.getenv("LLM_MODEL", "gpt-4o"))
    llm_temperature: float = float(os.getenv("LLM_TEMPERATURE", "0.2"))
    # OpenAI 兼容端点的 JSON 输出模式: schema | json_object | auto | none
    #   schema       = OpenAI Structured Outputs（response_format=json_schema）
    #   json_object  = 老式 JSON 模式（DeepSeek 等端点不支持 json_schema，需用此项）
    #   auto         = 按 base_url 含 "deepseek" 自动切换（默认）
    #   none         = 不传 response_format，仅靠 prompt 要求 JSON
    openai_json_mode: str = field(default_factory=lambda: os.getenv("OPENAI_JSON_MODE", "auto"))
    supervisor_openai_json_mode: str = field(
        default_factory=lambda: os.getenv("SUPERVISOR_OPENAI_JSON_MODE", os.getenv("OPENAI_JSON_MODE", "auto"))
    )

    # Supervisor 是控制平面，可配置为比业务 agent 更强的独立模型。未设置时继承通用 LLM 配置。
    supervisor_llm_provider: str = field(default_factory=lambda: os.getenv("SUPERVISOR_LLM_PROVIDER", _default_llm_provider()))
    supervisor_openai_api_key: str = field(default_factory=lambda: os.getenv("SUPERVISOR_OPENAI_API_KEY", os.getenv("OPENAI_API_KEY", "")))
    supervisor_openai_base_url: str = field(default_factory=lambda: os.getenv("SUPERVISOR_OPENAI_BASE_URL", os.getenv("OPENAI_BASE_URL", "")))
    supervisor_llm_model: str = field(default_factory=lambda: os.getenv("SUPERVISOR_LLM_MODEL", os.getenv("LLM_MODEL", "gpt-4o")))
    supervisor_llm_temperature: float = float(os.getenv("SUPERVISOR_LLM_TEMPERATURE", os.getenv("LLM_TEMPERATURE", "0.2")))

    # 模块级 agent 白名单硬约束：为 True 时 supervisor 强制把 LLM 计划约束到
    # INTENT_TABLE[task_type]["required_agents"] 白名单内（弱 LLM 的安全网）。
    supervisor_enforce_allowlist: bool = field(
        default_factory=lambda: os.getenv("SUPERVISOR_ENFORCE_ALLOWLIST", "1").lower() not in ("0", "false", "no")
    )

    # Ollama 本地模型
    ollama_base_url: str = field(default_factory=lambda: os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"))
    ollama_model: str = field(default_factory=lambda: os.getenv("OLLAMA_MODEL", "qwen2.5:7b"))
    supervisor_ollama_base_url: str = field(default_factory=lambda: os.getenv("SUPERVISOR_OLLAMA_BASE_URL", os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")))
    supervisor_ollama_model: str = field(default_factory=lambda: os.getenv("SUPERVISOR_OLLAMA_MODEL", os.getenv("OLLAMA_MODEL", "qwen2.5:7b")))

    # 检索相关参数
    top_k: int = int(os.getenv("TOP_K", "10"))

    # ---- 数据层（后端知识库）----
    # 数据源：server_mock（server/data/mock_data.py，默认）/ json（server/data/papers.json）/ sqlite（server/data/research.sqlite，真实入库）
    tool_data_source: str = field(default_factory=lambda: os.getenv("TOOL_DATA_SOURCE", "server_mock"))
    # json 数据源路径（可选，默认 server/data/papers.json）
    tool_data_path: str = field(default_factory=lambda: os.getenv("TOOL_DATA_PATH", ""))
    # SQLite 论文/会议库路径（可选，默认 server/data/research.sqlite）
    sqlite_path: str = field(default_factory=lambda: os.getenv("SQLITE_PATH", ""))
    # 向量检索 embedding 模型（Ollama 本地；不可用自动降级词法）
    embedding_model: str = field(default_factory=lambda: os.getenv("EMBEDDING_MODEL", "nomic-embed-text"))
    # 交叉编码器重排模型（可选，sentence-transformers；未安装/不可用自动跳过重排）
    rerank_model: str = field(default_factory=lambda: os.getenv("RERANK_MODEL", "cross-encoder/ms-marco-MiniLM-L-6-v2"))
    # HuggingFace 镜像端点（国内默认 hf-mirror.com，解决模型下载被墙）
    hf_endpoint: str = field(default_factory=lambda: os.getenv("HF_ENDPOINT", "https://hf-mirror.com"))

    @property
    def mock_mode(self) -> bool:
        return self.llm_provider == "mock"


settings = Settings()
