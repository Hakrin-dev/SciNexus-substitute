"""LLM 接入层：mock（默认，无外部依赖）/ openai（兼容端点）/ ollama（本地模型）。

所有 provider 都要求结构化输出：
- mock:     返回各 agent 预置的占位数据
- openai:   通过 openai SDK 的 response_format=json_schema 严格结构化输出
- ollama:   通过原生 /api/chat 接口，format 传入 JSON Schema 引导解码（qwen2.5 等本地模型）
"""
from __future__ import annotations

import json
from abc import ABC, abstractmethod

from pydantic import BaseModel

from research_assistant.config import settings


class LLMProvider(ABC):
    @abstractmethod
    def complete(self, system_prompt: str, user_payload: dict, output_model: type[BaseModel]) -> BaseModel:
        """以结构化方式让模型按 output_model 输出。"""

    def chat_text(self, system_prompt: str, user_text: str) -> str:
        """纯文本生成（非结构化）：用于最终回答组合等自然语言场景。

        基类默认不支持，返回空串表示不可用；真实 provider 覆写本方法。
        """
        return ""

    @property
    def name(self) -> str:
        return self.__class__.__name__


class MockProvider(LLMProvider):
    """Mock：返回 user_payload["_mock_data"]，保证完全符合 schema。"""

    def complete(self, system_prompt: str, user_payload: dict, output_model: type[BaseModel]) -> BaseModel:
        data = user_payload.get("_mock_data") or {}
        return output_model(**data)

    def translate(self, text: str, target_lang: str = "中文") -> str:
        """纯文本翻译（mock：返回占位提示，提示需配置真实 LLM）。"""
        return f"[mock 翻译] 需配置真实 LLM（LLM_PROVIDER=openai 或 ollama）后可用。原文：{text}"


_JSON_OBJECT_INSTRUCTION = (
    "请只输出一个合法的 JSON 对象作为最终回答，不要包含 Markdown 代码块围栏、注释或任何其他文字。"
)
_REPAIR_INSTRUCTION = (
    "上一条输出不是合法 JSON。请只输出一个符合要求的 JSON 对象，不要任何多余文字、不要 Markdown 代码块。"
)
TRANSLATE_SYSTEM_PROMPT = (
    "你是一名专业的学术翻译助手。请将用户给出的学术文本忠实、准确地翻译为{target_lang}。"
    "要求：\n"
    "1. 专业名词、技术术语保留英文原文（如 Transformer、attention、BERT）；\n"
    "2. 数学公式、LaTeX 表达式与符号保持不变；\n"
    "3. 只输出翻译后的文本，不要任何解释、注释或 Markdown 代码块围栏。"
)


def _strip_fences(text: str) -> str:
    """去掉模型可能输出的 markdown 代码块围栏。"""
    text = text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        lines = [ln for ln in lines if not ln.strip().startswith("```")]
        text = "\n".join(lines).strip()
    return text


def _parse_output(text: str, output_model: type[BaseModel]) -> BaseModel:
    """宽容解析：去掉围栏后校验；失败则尝试抽取首个 {...} 平衡块。"""
    cleaned = _strip_fences(text)
    try:
        return output_model.model_validate_json(cleaned)
    except Exception:
        start, end = cleaned.find("{"), cleaned.rfind("}")
        if start != -1 and end > start:
            return output_model.model_validate_json(cleaned[start : end + 1])
        raise


class OpenAIChatProvider(LLMProvider):
    """OpenAI 兼容接入，支持 json_schema（OpenAI）与 json_object（DeepSeek 等端点）。"""

    def __init__(self, api_key: str | None = None, base_url: str | None = None,
                 model: str | None = None, temperature: float | None = None,
                 json_mode: str | None = None) -> None:
        from openai import OpenAI

        self._client = OpenAI(api_key=api_key or settings.openai_api_key, base_url=base_url or settings.openai_base_url or None)
        self.model = model or settings.llm_model
        self.temperature = settings.llm_temperature if temperature is None else temperature
        self.base_url = base_url or settings.openai_base_url or ""
        self.json_mode = json_mode or settings.openai_json_mode

    def _resolve_json_mode(self) -> str:
        if self.json_mode == "auto":
            # DeepSeek 端点不支持 json_schema，自动切换为 json_object
            return "json_object" if "deepseek" in self.base_url.lower() else "schema"
        return self.json_mode

    def complete(self, system_prompt: str, user_payload: dict, output_model: type[BaseModel]) -> BaseModel:
        schema = output_model.model_json_schema()
        payload = {k: v for k, v in user_payload.items() if not k.startswith("_")}
        user_content = json.dumps(payload, ensure_ascii=False)
        mode = self._resolve_json_mode()

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ]
        kwargs = {"model": self.model, "temperature": self.temperature, "messages": messages}

        if mode == "schema":
            kwargs["response_format"] = {"type": "json_schema", "json_schema": {"name": output_model.__name__, "schema": schema}}
        elif mode == "json_object":
            # json_object 模式不强制 schema，需把结构喂给模型，否则字段名可能对不上
            messages[1]["content"] = (
                _JSON_OBJECT_INSTRUCTION
                + "\n请严格按照以下 JSON Schema 的字段名与结构输出：\n"
                + json.dumps(schema, ensure_ascii=False)
                + "\n\n任务输入：\n"
                + user_content
            )
            kwargs["response_format"] = {"type": "json_object"}
        # mode == "none": 不传 response_format，仅靠 prompt 约束

        raw_text: str | None = None
        try:
            resp = self._client.chat.completions.create(**kwargs)
            raw_text = resp.choices[0].message.content
            return _parse_output(raw_text, output_model)
        except Exception:
            # 仅在 json_object/none 模式且首轮已拿到文本时做一次修复重试，其余错误原样抛出
            if mode not in ("json_object", "none") or raw_text is None:
                raise
            repair = self._client.chat.completions.create(
                model=self.model,
                temperature=self.temperature,
                messages=messages
                + [{"role": "assistant", "content": raw_text}, {"role": "user", "content": _REPAIR_INSTRUCTION}],
                response_format={"type": "json_object"} if mode == "json_object" else None,
            )
            return _parse_output(repair.choices[0].message.content, output_model)

    def translate(self, text: str, target_lang: str = "中文") -> str:
        """纯文本翻译：不传 response_format，直接返回模型译出的自然语言文本。

        temperature 用 0.2 保证忠实翻译，不引入创造性改写。
        """
        messages = [
            {"role": "system", "content": TRANSLATE_SYSTEM_PROMPT.format(target_lang=target_lang)},
            {"role": "user", "content": text},
        ]
        resp = self._client.chat.completions.create(
            model=self.model,
            temperature=0.2,
            messages=messages,
        )
        return (resp.choices[0].message.content or "").strip()

    def chat_text(self, system_prompt: str, user_text: str) -> str:
        """纯文本生成：不传 response_format，用于最终回答组合等场景。"""
        resp = self._client.chat.completions.create(
            model=self.model,
            temperature=self.temperature,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_text},
            ],
        )
        return (resp.choices[0].message.content or "").strip()


class OllamaProvider(LLMProvider):
    """本地 Ollama 接入：原生 /api/chat，format 传 JSON Schema 做引导解码。

    qwen2.5:7b 在 Ollama 上支持 JSON Schema 约束生成；若该模型不支持严格 schema，
    自动降级为 format="json"（任意合法 JSON）后再由模型解析，最后仍用 pydantic 校验。
    """

    def __init__(self, base_url: str | None = None, model: str | None = None,
                 temperature: float | None = None) -> None:
        self.base_url = (base_url or settings.ollama_base_url).rstrip("/")
        self.model = model or settings.ollama_model
        self.temperature = settings.llm_temperature if temperature is None else temperature

    def complete(self, system_prompt: str, user_payload: dict, output_model: type[BaseModel]) -> BaseModel:
        import urllib.request
        import urllib.error

        schema = output_model.model_json_schema()
        payload = {k: v for k, v in user_payload.items() if not k.startswith("_")}
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
        ]
        body = {
            "model": self.model,
            "messages": messages,
            "stream": False,
            "options": {"temperature": self.temperature},
        }
        last_error: Exception | None = None
        for fmt in (schema, "json"):
            body["format"] = fmt
            try:
                req = urllib.request.Request(
                    f"{self.base_url}/api/chat",
                    data=json.dumps(body).encode("utf-8"),
                    headers={"Content-Type": "application/json"},
                )
                with urllib.request.urlopen(req, timeout=120) as resp:
                    raw = json.loads(resp.read().decode("utf-8"))
                text = raw["message"]["content"]
                return output_model.model_validate_json(_strip_fences(text))
            except urllib.error.HTTPError as e:
                # HTTP 层错误（如模型不存在返回 404），读取响应体给出准确提示，不降级重试
                body = e.read().decode("utf-8", errors="replace")
                raise RuntimeError(f"Ollama 请求失败 (HTTP {e.code}) {self.base_url}: {body or e.reason}") from e
            except urllib.error.URLError as e:
                # 传输层错误（如服务未启动）不降级重试，直接抛出以便定位
                raise ConnectionError(f"无法连接 Ollama ({self.base_url}): {e}") from e
            except Exception as e:  # JSON 解析或 schema 校验失败 -> 降级重试
                last_error = e
        raise RuntimeError(f"Ollama 结构化输出校验失败({self.model}): {last_error}")

    def translate(self, text: str, target_lang: str = "中文") -> str:
        """纯文本翻译：不传 format 键（自然语言生成），返回模型译出的译文。"""
        import urllib.request
        import urllib.error

        messages = [
            {"role": "system", "content": TRANSLATE_SYSTEM_PROMPT.format(target_lang=target_lang)},
            {"role": "user", "content": text},
        ]
        body = {
            "model": self.model,
            "messages": messages,
            "stream": False,
            "options": {"temperature": 0.2},
        }
        try:
            req = urllib.request.Request(
                f"{self.base_url}/api/chat",
                data=json.dumps(body).encode("utf-8"),
                headers={"Content-Type": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=120) as resp:
                raw = json.loads(resp.read().decode("utf-8"))
            return (raw["message"]["content"] or "").strip()
        except urllib.error.HTTPError as e:
            # HTTP 层错误（如模型不存在返回 404），读取响应体给出准确提示
            err_body = e.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"Ollama 翻译请求失败 (HTTP {e.code}) {self.base_url}: {err_body or e.reason}") from e
        except urllib.error.URLError as e:
            # 传输层错误（如服务未启动）直接抛出以便定位
            raise ConnectionError(f"无法连接 Ollama ({self.base_url}): {e}") from e

    def chat_text(self, system_prompt: str, user_text: str) -> str:
        """纯文本生成：不传 format 键（自然语言生成），用于最终回答组合等场景。"""
        import urllib.request
        import urllib.error

        body = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_text},
            ],
            "stream": False,
            "options": {"temperature": self.temperature},
        }
        try:
            req = urllib.request.Request(
                f"{self.base_url}/api/chat",
                data=json.dumps(body).encode("utf-8"),
                headers={"Content-Type": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=120) as resp:
                raw = json.loads(resp.read().decode("utf-8"))
            return (raw["message"]["content"] or "").strip()
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"Ollama 请求失败 (HTTP {e.code}) {self.base_url}: {err_body or e.reason}") from e
        except urllib.error.URLError as e:
            raise ConnectionError(f"无法连接 Ollama ({self.base_url}): {e}") from e


def get_llm(model: str | None = None) -> LLMProvider:
    if settings.mock_mode:
        return MockProvider()
    if settings.llm_provider == "ollama":
        return OllamaProvider(model=model or settings.ollama_model)
    return OpenAIChatProvider(model=model)


def get_supervisor_llm(model: str | None = None) -> LLMProvider:
    """创建 Supervisor 专用模型，默认继承业务 agent 的 LLM 配置。"""
    provider = settings.supervisor_llm_provider
    if provider == "mock":
        return MockProvider()
    if provider == "ollama":
        return OllamaProvider(
            base_url=settings.supervisor_ollama_base_url,
            model=model or settings.supervisor_ollama_model,
            temperature=settings.supervisor_llm_temperature,
        )
    return OpenAIChatProvider(
        api_key=settings.supervisor_openai_api_key,
        base_url=settings.supervisor_openai_base_url,
        model=model or settings.supervisor_llm_model,
        temperature=settings.supervisor_llm_temperature,
        json_mode=settings.supervisor_openai_json_mode,
    )
