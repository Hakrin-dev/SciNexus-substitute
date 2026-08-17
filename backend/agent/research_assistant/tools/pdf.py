"""PDF 解析：读取 server/data/pdfs/{paper_id}.pdf 生成 chunk（含页码/坐标估计/文本）。

无真实 PDF 文件时回退：用论文摘要 + 已入库的结构化分析（paper_analysis）分块，
保证返回结构一致且尽可能带上创新点/方法/实验等细节。
"""
from __future__ import annotations

import logging
import re
from pathlib import Path

from research_assistant.tools.data_source import backend

logger = logging.getLogger(__name__)

_CHUNK_SIZE = 900

# 结构化分析的章节字段（优先 zh 中文研读，其次英文 content）
_ANALYSIS_SECTIONS = (
    "summary",
    "core_innovation",
    "methodology",
    "experiments",
    "experimental_results",
    "limitations",
    "key_challenges",
)


def _chunk_text(text: str, paper_id: str, page: int) -> list[dict]:
    text = text.strip()
    if not text:
        return []
    chunks: list[dict] = []
    # 按空白/换行切分段落，再按 _CHUNK_SIZE 合并
    segments = re.split(r"\n+", text)
    buf = ""
    seq = 0
    for seg in segments:
        seg = seg.strip()
        if not seg:
            continue
        if buf and len(buf) + len(seg) > _CHUNK_SIZE:
            seq += 1
            chunks.append(_make_chunk(paper_id, page, seq, buf))
            buf = seg
        else:
            buf = (buf + "\n" + seg) if buf else seg
    if buf:
        seq += 1
        chunks.append(_make_chunk(paper_id, page, seq, buf))
    return chunks


def _make_chunk(paper_id: str, page: int, seq: int, text: str) -> dict:
    return {
        "chunk_id": f"{paper_id}-p{page}-c{seq}",
        "page": page,
        "bbox": [0, (page - 1) * 100, 600, page * 100],  # 坐标估计，前端高亮占位
        "text": text,
    }


def _analysis_as_text(paper_id: str) -> str:
    """从 paper_analysis 表读取已入库的结构化分析，合并为纯文本；无记录时返回 ""。"""
    try:
        analysis = backend.store.load_structured_analysis(paper_id)
    except Exception as exc:
        logger.warning(f"读取 {paper_id} 结构化分析失败，忽略: {exc}")
        return ""
    if not analysis or not isinstance(analysis, dict):
        return ""

    zh = analysis.get("zh") if isinstance(analysis.get("zh"), dict) else {}
    sections: list[str] = []
    for key in _ANALYSIS_SECTIONS:
        entry = zh.get(key) if key in zh else analysis.get(key)
        if isinstance(entry, dict):
            content = entry.get("content") or ""
        else:
            content = entry
        content = str(content or "").strip()
        if content:
            sections.append(f"## {key}\n{content}")
    return "\n\n".join(sections)


# --------------------------------------------------------------------------- #
# 页眉/页脚/水印噪声行模式（跨页重复出现，不属于正文内容）
# --------------------------------------------------------------------------- #
_NOISE_PATTERNS: tuple[re.Pattern[str], ...] = (
    # 期刊页眉（全大写，如 "PLOS DIGITAL HEALTH"）
    re.compile(r"^PLOS\s+[A-Z][A-Z\s]{2,40}$"),
    # 页眉含 DOI：如 "PLOS Digital Health | https://doi.org/..."
    re.compile(r"\|\s*https?://"),
    # 纯 URL / DOI 行
    re.compile(r"^(?:https?://|doi\.org/|www\.)\S*\s*$", re.IGNORECASE),
    # 页码 "1 / 12" 或 "1/12"
    re.compile(r"^\d+\s*/\s*\d+\s*$"),
    # 纯日期 "February 9, 2023"
    re.compile(
        r"^(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\s*$",
        re.IGNORECASE,
    ),
    # PLOS 水印 "a1111111111"
    re.compile(r"^a\d+\s*$", re.IGNORECASE),
    # 引用元数据行 "Citation: / Accepted: / Published: / Copyright: ..."
    re.compile(
        r"^(?:Citation|Accepted|Published|Received|Copyright|Peer Review History|Data Availability|Funding|Competing Interests)\s*:",
        re.IGNORECASE,
    ),
)


def _clean_extracted_text(text: str) -> str:
    """清洗页面提取文本：丢弃页眉/页脚/水印噪声行，行内空白规范化为单个空格。"""
    kept: list[str] = []
    for raw in text.split("\n"):
        line = raw.strip()
        if not line:
            kept.append("")
            continue
        if any(p.search(line) for p in _NOISE_PATTERNS):
            continue
        kept.append(re.sub(r"[ \t]+", " ", line))
    return re.sub(r"\n{3,}", "\n\n", "\n".join(kept))


def _extract_pdf_chunks(pdf_path: str, paper_id: str) -> list[dict]:
    """提取 PDF 全文并分块。优先 PyMuPDF（字符间距更干净，避免字母被拆碎），
    提取失败或无可用结果时回退 pypdf。"""
    try:
        import fitz  # PyMuPDF，lazy import

        doc = fitz.open(pdf_path)
        chunks: list[dict] = []
        for i, page in enumerate(doc, start=1):
            text = _clean_extracted_text(page.get_text() or "")
            chunks.extend(_chunk_text(text, paper_id, i))
        doc.close()
        if chunks:
            return chunks
    except Exception as exc:
        logger.warning(f"PyMuPDF 提取失败，回退 pypdf: {exc}")

    from pypdf import PdfReader  # noqa: PLC0415

    reader = PdfReader(pdf_path)
    chunks: list[dict] = []
    for i, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""
        chunks.extend(_chunk_text(text, paper_id, i))
    return chunks


def parse_pdf(paper_id: str, pdf_dir: Path, max_chunks: int | None = 60) -> dict:
    """解析论文 PDF；文件不存在或解析失败时回退为摘要 + 结构化分析分块。

    max_chunks 控制 PDF 分支返回的最大分块数（默认 60，与原有行为一致）；
    传 None 表示返回全部全文分块（阅读页"原文"展示用）。
    回退分支（摘要 + 结构化分析）不受 max_chunks 影响。
    工程保护：校验 %PDF 文件头与 30MB 上限（与 evidence/reader 一致）。
    """
    pdf_path = pdf_dir / f"{paper_id}.pdf"
    if pdf_path.exists() and pdf_path.stat().st_size <= 30 * 1024 * 1024:
        try:
            head = pdf_path.open("rb").read(4)
            if head == b"%PDF":
                chunks = _extract_pdf_chunks(str(pdf_path), paper_id)
                if chunks:
                    return {
                        "paper_id": paper_id,
                        "source": str(pdf_path),
                        "chunks": (chunks[:max_chunks] if max_chunks else chunks),
                    }
        except Exception as exc:
            logger.warning(f"PDF 解析失败，回退摘要: {paper_id}: {exc}")

    p = backend.get_paper(paper_id) or {}
    abstract = p.get("abstract", "")
    chunks = _chunk_text(abstract, paper_id, 1) or [
        _make_chunk(paper_id, 1, 1, abstract or "（无摘要）")
    ]
    # 合并已入库的结构化分析（创新点/方法/实验/局限），不会因空表而崩溃
    analysis_text = _analysis_as_text(paper_id)
    if analysis_text:
        chunks.extend(_chunk_text(analysis_text, paper_id, 1))
        return {"paper_id": paper_id, "source": "analysis_fallback", "chunks": chunks}
    return {"paper_id": paper_id, "source": "abstract_fallback", "chunks": chunks}
