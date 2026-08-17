"""批量解析 server/data/pdfs 下的真实 PDF，生成结构化论文分析并写入 paper_analysis 表。

纯本地启发式处理（pypdf 文本提取 + 关键词/TF-IDF 证据检索），不调用任何 LLM。
以 PDF 文件名的 stem（OpenAlex W-id）作为 paper_id，与 papers 表一一对应；
只写 paper_analysis 表，绝不触碰 papers/venues 两表（依赖 PaperStore.open 的保证）。

幂等：第二次运行默认跳过已有分析的论文（analyzed=0）；--force 可强制重跑。

用法：
    python agent/scripts/ingest_pdfs.py                       # 默认处理 server/data/pdfs/*.pdf
    python agent/scripts/ingest_pdfs.py --force               # 强制重处理已有分析的论文
    python agent/scripts/ingest_pdfs.py --abstract-fallback   # 无 PDF 的论文改用摘要生成分析
    python agent/scripts/ingest_pdfs.py --limit 5 --print 1   # 测试：只处理前 5 篇并打印 1 篇分析
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

AGENT_DIR = Path(__file__).resolve().parents[1]
if str(AGENT_DIR) not in sys.path:
    sys.path.insert(0, str(AGENT_DIR))

from research_assistant.tools.evidence.hybrid import build_structured_analysis  # noqa: E402
from research_assistant.tools.evidence.reader import MAX_PDF_BYTES, extract_pdf_chunks  # noqa: E402
from research_assistant.tools.store import PaperStore  # noqa: E402

PROJECT_ROOT = AGENT_DIR.parent

FALLBACK_SECTIONS = ("summary", "core_innovation", "methodology", "experiments", "limitations")


def _abstract_analysis(paper_id: str, abstract: str) -> dict:
    """无 PDF 时基于摘要生成结构化分析（各节内容一致，标注来源为摘要）。"""
    text = abstract.strip()
    if not text:
        text = "（OpenAlex 未提供摘要，暂无正文分析；如需完整研读请上传 PDF。）"
    base = {
        "content": text,
        "evidence": [{"page": 1, "chunk_id": f"{paper_id}-p1-c1", "quote": text[:800]}],
    }
    analysis = {section: {**base} for section in FALLBACK_SECTIONS}
    analysis["note"] = "无 PDF 正文，此分析基于论文摘要生成；如需完整创新点/实验数据，请上传 PDF。"
    return analysis


def _resolve_path(raw: str) -> Path:
    """相对路径一律以项目根目录为基准解析，保证从任意 cwd 运行结果一致。"""
    path = Path(raw)
    return path if path.is_absolute() else PROJECT_ROOT / path


def main() -> None:
    parser = argparse.ArgumentParser(description="批量解析 PDF 生成结构化论文分析并入库")
    parser.add_argument("--db", default="server/data/research.sqlite", help="SQLite 路径（相对项目根目录）")
    parser.add_argument("--pdf-dir", default="server/data/pdfs", help="PDF 目录（相对项目根目录）")
    parser.add_argument("--force", action="store_true", help="强制重新处理已有分析的论文")
    parser.add_argument("--abstract-fallback", action="store_true", help="对无 PDF 的论文用摘要生成分析")
    parser.add_argument("--limit", type=int, default=None, help="仅处理前 N 篇 PDF（测试用）")
    parser.add_argument("--print", dest="print_n", type=int, default=0, help="打印前 N 篇分析的 JSON 摘要")
    args = parser.parse_args()

    db_path = _resolve_path(args.db)
    pdf_dir = _resolve_path(args.pdf_dir)

    papers, _venues = PaperStore.load(str(db_path))
    by_id = {p["paper_id"]: p for p in papers}
    sqlite_ids = set(by_id)
    if not sqlite_ids:
        print(f"错误：SQLite 库 {db_path} 中没有论文数据，请先运行 ingest_openalex.py 导入论文。")
        sys.exit(1)

    store = PaperStore.open(str(db_path))
    try:
        existing = store.all_analysis_ids()
        pdfs = sorted(pdf_dir.glob("*.pdf"))
        if args.limit is not None:
            pdfs = pdfs[: args.limit]

        analyzed = 0
        skipped = 0
        unmatched = 0
        failed: list[tuple[str, str]] = []
        printed = 0

        for pdf_path in pdfs:
            paper_id = pdf_path.stem
            if paper_id not in sqlite_ids:
                unmatched += 1
                continue
            if paper_id in existing and not args.force:
                skipped += 1
                continue
            try:
                pdf_bytes = pdf_path.read_bytes()
                if not pdf_bytes.startswith(b"%PDF"):
                    failed.append((paper_id, "非 PDF 文件（缺少 %PDF 头）"))
                    continue
                if len(pdf_bytes) > MAX_PDF_BYTES:
                    failed.append((paper_id, "超过 30MB"))
                    continue
                chunks, _page_count = extract_pdf_chunks(pdf_bytes)
                analysis = build_structured_analysis(chunks)
                store.save_structured_analysis(paper_id, analysis)
                analyzed += 1
                if printed < args.print_n:
                    print(f"--- {paper_id} ---")
                    print(json.dumps(analysis, ensure_ascii=False, indent=2))
                    printed += 1
            except Exception as exc:  # noqa: BLE001  单篇失败不影响其余文件
                failed.append((paper_id, f"提取失败：{exc}"))

        print(
            f"分析完成：analyzed={analyzed}, skipped={skipped}, "
            f"unmatched={unmatched}, failed={len(failed)}"
        )
        for paper_id, reason in failed:
            print(f"  failed {paper_id}: {reason}")

        if args.abstract_fallback:
            pdf_stems = {p.stem for p in pdf_dir.glob("*.pdf")}
            fallback_analyzed = 0
            fallback_skipped = 0
            for paper_id in sorted(sqlite_ids):
                if paper_id in pdf_stems:
                    continue  # 有 PDF 的由上方 PDF 循环处理
                if paper_id in existing and not args.force:
                    fallback_skipped += 1
                    continue
                try:
                    analysis = _abstract_analysis(paper_id, by_id[paper_id].get("abstract", ""))
                    store.save_structured_analysis(paper_id, analysis)
                    fallback_analyzed += 1
                except Exception as exc:  # noqa: BLE001
                    failed.append((paper_id, f"摘要回退失败：{exc}"))
            print(f"摘要回退：analyzed={fallback_analyzed}, skipped={fallback_skipped}")
    finally:
        store.close()


if __name__ == "__main__":
    main()
