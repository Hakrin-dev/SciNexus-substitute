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


def _env_bool(key: str, default: bool = False) -> bool:
    raw = os.getenv(key)
    if raw is None or raw == "":
        return default
    return raw.strip().lower() not in ("0", "false", "no", "off")


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

    # ---- 远程知识底座 ----
    # remote = 远程优先；local = 仅本地；hybrid = 远程优先并保留本地降级/后续融合入口
    retrieval_provider: str = field(default_factory=lambda: os.getenv("RETRIEVAL_PROVIDER", "remote").lower())
    retrieval_api_url: str = field(default_factory=lambda: os.getenv("RETRIEVAL_API_URL", "http://47.110.47.12"))
    retrieval_timeout_seconds: float = float(os.getenv("RETRIEVAL_TIMEOUT_SECONDS", "30"))
    retrieval_retry_count: int = int(os.getenv("RETRIEVAL_RETRY_COUNT", "2"))
    retrieval_default_top_k: int = int(os.getenv("RETRIEVAL_DEFAULT_TOP_K", "10"))
    retrieval_fallback_local: bool = field(default_factory=lambda: _env_bool("RETRIEVAL_FALLBACK_LOCAL", True))
    retrieval_api_token: str = field(default_factory=lambda: os.getenv("RETRIEVAL_API_TOKEN", ""))
    retrieval_circuit_failure_threshold: int = int(os.getenv("RETRIEVAL_CIRCUIT_FAILURE_THRESHOLD", "3"))
    retrieval_circuit_reset_seconds: int = int(os.getenv("RETRIEVAL_CIRCUIT_RESET_SECONDS", "30"))
    retrieval_allow_insecure_http: bool = field(default_factory=lambda: _env_bool("RETRIEVAL_ALLOW_INSECURE_HTTP", False))

    # ---- 文献综述（综述写作，移植自 SZDR paperreport）----
    review_claim_max_chars: int = int(os.getenv("REVIEW_CLAIM_MAX_CHARS", "120"))
    review_dimensions_min: int = int(os.getenv("REVIEW_DIMENSIONS_MIN", "3"))
    review_dimensions_max: int = int(os.getenv("REVIEW_DIMENSIONS_MAX", "6"))
    review_max_refs: int = int(os.getenv("REVIEW_MAX_REFS", "20"))  # 单篇综述最多引用论文数
    # 质量签名小节开关（镜像 SZDR passes 门控）
    review_pass_findings: bool = field(default_factory=lambda: _env_bool("REVIEW_PASS_FINDINGS", True))
    review_pass_table: bool = field(default_factory=lambda: _env_bool("REVIEW_PASS_TABLE", True))
    review_pass_timeline: bool = field(default_factory=lambda: _env_bool("REVIEW_PASS_TIMELINE", True))
    review_findings_k: int = int(os.getenv("REVIEW_FINDINGS_K", "5"))
    review_table_min_refs: int = int(os.getenv("REVIEW_TABLE_MIN_REFS", "3"))
    review_table_max_refs: int = int(os.getenv("REVIEW_TABLE_MAX_REFS", "12"))
    review_timeline_max_phases: int = int(os.getenv("REVIEW_TIMELINE_MAX_PHASES", "4"))

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
