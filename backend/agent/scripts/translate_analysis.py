"""批量把论文的英文结构化摘录翻译/改写为中文研读笔记，写入 paper_analysis 的 zh 字段。

用法（项目根目录或 agent/ 下均可）：
    python agent/scripts/translate_analysis.py                  # 翻译全部未翻译的论文
    python agent/scripts/translate_analysis.py --limit 1        # 只翻译 1 篇（测试）
    python agent/scripts/translate_analysis.py --force          # 重新翻译已翻译的论文
    python agent/scripts/translate_analysis.py --dry-run        # 只打印将要翻译的论文，不调用 LLM

依赖：
- agent/.env 中的 OPENAI_API_KEY / OPENAI_BASE_URL / LLM_MODEL（OpenAI 兼容端点，如 DeepSeek）
- paper_analysis 表已有英文 structured（先跑 scripts/ingest_pdfs.py）

输出结构（新增 zh 键，英文原文与 evidence 保持不变）：
    {
      ...原英文 structured...,
      "zh": {
        "summary": "中文摘要…",
        "core_innovation": "中文创新点…",
        "methodology": "中文方法…",
        "experiments": "中文实验…",
        "limitations": "中文局限…",
        "translated_at": "2026-08-11T..."
      }
    }
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

AGENT_DIR = Path(__file__).resolve().parents[1]
if str(AGENT_DIR) not in sys.path:
    sys.path.insert(0, str(AGENT_DIR))

from pydantic import BaseModel, Field  # noqa: E402

from research_assistant.llm import OpenAIChatProvider  # noqa: E402
from research_assistant.tools.store import PaperStore  # noqa: E402

PROJECT_ROOT = AGENT_DIR.parent

SECTIONS = ("summary", "core_innovation", "methodology", "experiments", "limitations")


class ZhAnalysis(BaseModel):
    """中文研读笔记：与英文 structured 的 section 一一对应。"""
    summary: str = Field(min_length=10, description="摘要的中文研读")
    core_innovation: str = Field(min_length=10, description="创新点的中文研读")
    methodology: str = Field(min_length=10, description="方法的中文研读")
    experiments: str = Field(min_length=10, description="实验与结果的中文研读")
    limitations: str = Field(min_length=10, description="局限与挑战的中文研读")


SYSTEM_PROMPT = """你是研枢（YanShu）科研平台的论文研读助手。
用户会提供一篇论文的英文结构化摘录（按 摘要/创新点/方法/实验/局限 分节，可能包含句子中间开始的原文片段）。
请将其翻译并改写为简洁、准确、连贯的中文研读笔记。要求：
1. 忠实原文，不编造任何数据或结论；原文缺失的信息不要补写；
2. 模型名、数据集名、方法名等专有名词保留英文，首次出现时可加中文注释（如 Med-PaLM（医学语言模型））；
3. 实验部分保留关键数字指标与对比结果；
4. 每节 100-300 字，分点清晰，去掉原文中重复的引导性词句（如 "Abstract" 标题本身）；
5. 原文片段若从句子中间开始（开头小写），尽量用上下文补齐使其通顺，但不要编造；
6. 只输出符合给定 JSON Schema 的 JSON 对象，不要任何多余文字。"""


def _resolve_path(raw: str) -> Path:
    path = Path(raw)
    return path if path.is_absolute() else PROJECT_ROOT / path


def _english_preview(analysis: dict) -> dict[str, str]:
    """从英文 structured 提取各节纯文本，供翻译使用。"""
    preview: dict[str, str] = {}
    for section in SECTIONS:
        content = (analysis.get(section) or {}).get("content") or ""
        preview[section] = content
    return preview


def _provider() -> OpenAIChatProvider:
    from research_assistant.config import settings  # noqa: PLC0415

    return OpenAIChatProvider(
        api_key=settings.openai_api_key,
        base_url=settings.openai_base_url or None,
        model=settings.llm_model,
        json_mode=settings.openai_json_mode,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="批量生成论文中文研读笔记（zh 字段）")
    parser.add_argument("--db", default="server/data/research.sqlite", help="SQLite 路径（相对项目根目录）")
    parser.add_argument("--limit", type=int, default=None, help="仅处理前 N 篇（测试用）")
    parser.add_argument("--force", action="store_true", help="重新翻译已有 zh 的论文")
    parser.add_argument("--dry-run", action="store_true", help="只打印待翻译论文，不调用 LLM")
    args = parser.parse_args()

    db_path = _resolve_path(args.db)
    store = PaperStore.open(str(db_path))
    paper_ids = sorted(store.all_analysis_ids())
    if not paper_ids:
        print(f"错误：{db_path} 的 paper_analysis 为空，请先运行 ingest_pdfs.py。")
        sys.exit(1)

    # 未翻译的排前面，保证 --limit 分批跑时优先处理剩余论文
    def _zh_done(pid: str) -> int:
        analysis = store.load_structured_analysis(pid) or {}
        return 0 if ("zh" in analysis and not args.force) else 1

    paper_ids.sort(key=_zh_done, reverse=True)
    if args.limit is not None:
        paper_ids = paper_ids[: args.limit]

    translated = 0
    skipped = 0
    failed: list[tuple[str, str]] = []
    provider = None if args.dry_run else _provider()

    for paper_id in paper_ids:
        analysis = store.load_structured_analysis(paper_id) or {}
        if "zh" in analysis and not args.force:
            skipped += 1
            continue
        english = _english_preview(analysis)
        if not any(english.values()):
            failed.append((paper_id, "没有英文摘录内容，跳过"))
            continue
        if args.dry_run:
            print(f"  [dry-run] {paper_id} 待翻译")
            translated += 1
            continue
        try:
            assert provider is not None
            result = provider.complete(SYSTEM_PROMPT, {"english_analysis": english}, ZhAnalysis)
            zh = result.model_dump()
            zh["translated_at"] = datetime.now(timezone.utc).isoformat()
            analysis["zh"] = zh
            store.save_structured_analysis(paper_id, analysis)
            translated += 1
        except Exception as exc:  # noqa: BLE001
            failed.append((paper_id, f"{type(exc).__name__}: {exc}"))

    store.close()
    print(f"翻译完成：translated={translated}, skipped={skipped}, failed={len(failed)}")
    for paper_id, reason in failed:
        print(f"  failed {paper_id}: {reason}")


if __name__ == "__main__":
    main()
