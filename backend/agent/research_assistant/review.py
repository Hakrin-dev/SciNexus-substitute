"""文献综述生成管线（移植自 SZDR paperreport：三阶段综合 + 引用解析 + 质量签名小节）。

设计对齐（当前仅中文）：
- 阶段一：逐篇从摘要提取忠实论断（结构化输出）；
- 阶段二：论断聚类成 3–6 个研究维度，漏归论文补聚类，维护「全分划不变式」
  （提取过论断的每篇论文必须归入某维度，否则其论断会静默丢失）；
- 阶段三：逐维度成文（散文调用，节末自带「### 要点」），开篇「## 摘要」一次调用；
- 引用解析：正文用全局编号 [n]，`resolve_citations` 按首次出现前序重编号、
  剔除悬空引用、自动生成文末「参考文献」，保证正文与文献一一对应、零幽灵引用；
- 质量 passes（配置门控）：核心发现面板 / 自动对比表（三次调用）/ 研究脉络时间线；
- mock 模式：每一步都有确定性回退，与真实模式走同一条代码路径，可离线联调。

调用方：writer agent 的 literature_review 分支；`build_literature_review` 为唯一入口。
"""
from __future__ import annotations

import logging
import re

from research_assistant.config import settings
from research_assistant.llm import LLMProvider
from research_assistant.schemas import (
    ReviewAssignments,
    ReviewAttributes,
    ReviewClaims,
    ReviewCluster,
    ReviewFindings,
    ReviewTable,
    ReviewTimeline,
)
from research_assistant.tools.data_source import backend

log = logging.getLogger(__name__)

_CITE_TOKEN = re.compile(r"\[([0-9,\s\-–—]+)\]")
_RANGE_SPAN_CAP = 64
_ABSTRACT_CAP = 600  # 渲染进提示词的摘要长度上限

# mock 模式的确定性维度名（真实模式由 LLM 聚类生成）
_MOCK_DIMENSIONS = ["方法演进", "实验与评测", "挑战与未来方向"]
_MOCK_TABLE_ATTRS = ["技术路线", "核心机制", "评测数据", "主要结论"]


# --------------------------------------------------------------------------- #
# 证据渲染与编号（对齐 SZDR prompts.render_evidence / cite.number_evidence）
# --------------------------------------------------------------------------- #
def normalize_title(title: str) -> str:
    """标题归一化：小写 + 非字母数字/CJK → 空格 + 折叠空白。库级去重共用。"""
    if not title:
        return ""
    return " ".join("".join(ch if ch.isalnum() else " " for ch in title.lower()).split())


def _load_papers(paper_ids: list[str]) -> list[dict]:
    """按 paper_id 去重 + 归一化标题去重，返回顺序即全局编号 1..N（受 review_max_refs 封顶）。"""
    papers: list[dict] = []
    seen_ids: set[str] = set()
    seen_titles: set[str] = set()
    for pid in paper_ids:
        if not pid or pid in seen_ids:
            continue
        p = backend.get_paper(pid)
        if not p:
            continue
        seen_ids.add(pid)
        nt = normalize_title(p.get("title") or "")
        if nt and nt in seen_titles:
            continue
        if nt:
            seen_titles.add(nt)
        papers.append(p)
        if len(papers) >= settings.review_max_refs:
            break
    return papers


def render_evidence(papers: list[dict]) -> str:
    """渲染编号证据块：`[n] 标题（作者，年份，venue）。摘要: ...`（编号 = 位置 + 1）。"""
    entries = []
    for i, p in enumerate(papers, 1):
        title = p.get("title") or "Untitled"
        meta = ", ".join(str(x) for x in [p.get("author"), p.get("year"), p.get("venue")] if x)
        head = f"[{i}] {title}" + (f"（{meta}）" if meta else "") + "."
        abstract = str(p.get("abstract") or "").strip().replace("\n", " ")
        if abstract:
            head += "\n摘要: " + abstract[:_ABSTRACT_CAP]
        entries.append(head)
    return "\n\n".join(entries)


# --------------------------------------------------------------------------- #
# 引用解析（对齐 SZDR cite.resolve：范围展开 / 首次出现重排 / 悬空剔除）
# --------------------------------------------------------------------------- #
def parse_numbers(s: str) -> list[int]:
    """解析引用 token 内编号；`a-b`/`a–b`/`a—b` 范围展开为逐一编号，越界范围丢弃。"""
    nums: list[int] = []
    for part in re.split(r"[,\s]+", s.strip()):
        if not part:
            continue
        m = re.match(r"^(\d+)\s*[-–—]\s*(\d+)$", part)
        if m:
            lo, hi = int(m.group(1)), int(m.group(2))
            if lo <= hi and hi - lo < _RANGE_SPAN_CAP:
                nums.extend(range(lo, hi + 1))
            continue
        try:
            nums.append(int(part))
        except ValueError:
            continue
    return nums


def _cited_numbers(markdown: str) -> list[int]:
    """扫描正文全部引用编号（含范围展开），按出现顺序。"""
    nums: list[int] = []
    for m in _CITE_TOKEN.finditer(markdown):
        nums.extend(parse_numbers(m.group(1)))
    return nums


def resolve_citations(markdown: str, papers: list[dict]) -> tuple[str, list[dict]]:
    """校验正文引用并产出（修正后的正文, 参考文献列表）。

    - 合法编号（1..N）按首次出现顺序重编号 [1..M]；
    - 悬空引用（越界/重复）从正文剔除；
    - 未被引用的论文不进参考文献。
    文末「## 参考文献」节由 `render_references` 单独渲染（保证其位于全文最后）。
    """
    n = len(papers)
    if n == 0:
        return markdown, []
    old_to_new: dict[int, int] = {}
    for num in _cited_numbers(markdown):
        if 1 <= num <= n and num not in old_to_new:
            old_to_new[num] = len(old_to_new) + 1
    if not old_to_new:
        return markdown, []

    def _replace(m: re.Match) -> str:
        mapped = [old_to_new[x] for x in parse_numbers(m.group(1)) if x in old_to_new]
        return "".join(f"[{x}]" for x in mapped)

    fixed = _CITE_TOKEN.sub(_replace, markdown)
    refs = [papers[k - 1] for k in sorted(old_to_new, key=old_to_new.get)]
    return fixed, refs


def render_references(refs: list[dict]) -> str:
    """渲染「## 参考文献」节：`[n] 作者. 标题. 会议, 年份.`（IEEE 风格，字段尾部去点防双句号）。"""
    if not refs:
        return ""
    lines = []
    for i, p in enumerate(refs, 1):
        author = str(p.get("author") or "Unknown authors").strip().rstrip(".")
        title = str(p.get("title") or "Untitled").strip().rstrip(".")
        venue = str(p.get("venue") or "Unknown venue").strip().rstrip(".")
        year = p.get("year") or ""
        lines.append(f"[{i}] {author}. {title}. {venue}, {year}.")
    return "## 参考文献\n\n" + "\n".join(lines) + "\n"


# --------------------------------------------------------------------------- #
# 结构化调用封装：mock 走确定性回显，真实模式走 LLM 受约束 schema
# --------------------------------------------------------------------------- #
def _structured(
    llm: LLMProvider,
    mock: bool,
    system: str,
    payload: dict,
    model: type,
    mock_data: dict,
):
    if mock:
        return model(**mock_data)
    return llm.complete(system, payload, model)


def _clean_numbers(raw, total: int) -> list[int]:
    """校验并去重 1..total 范围内的编号，越界丢弃。"""
    raw = raw if isinstance(raw, list) else [raw]
    out: list[int] = []
    seen: set[int] = set()
    for v in raw:
        try:
            n = int(v)
        except (TypeError, ValueError):
            continue
        if 1 <= n <= total and n not in seen:
            seen.add(n)
            out.append(n)
    return out


def _as_bool(value) -> bool:
    """LLM 布尔字段宽松解析：`false`/`"false"`/`0`/`否` 均视为假。"""
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    return str(value).strip().lower() not in {"", "0", "false", "no", "否", "false."}


def _short(text: str, limit: int) -> str:
    text = str(text or "").strip()
    return text if len(text) <= limit else text[:limit].rstrip() + "..."


# --------------------------------------------------------------------------- #
# 阶段一：逐篇提取论断
# --------------------------------------------------------------------------- #
def _mock_claims(topic: str, papers: list[dict]) -> dict:
    """确定性论断：取摘要首句（无摘要时用标题兜底），保证 mock 路径稳定。"""
    entries = []
    for i, p in enumerate(papers, 1):
        abstract = str(p.get("abstract") or "").strip()
        sentence = re.split(r"[。.!?]", abstract)[0].strip() if abstract else ""
        if not sentence:
            sentence = f"{p.get('title') or '该工作'}围绕“{topic}”提出方法并通过实验验证了有效性"
        entries.append({"index": i, "claims": [_short(sentence, settings.review_claim_max_chars)]})
    return {"papers": entries}


def extract_claims(llm: LLMProvider, mock: bool, topic: str, papers: list[dict]) -> list[dict]:
    """阶段一：逐篇从摘要提取忠实论断，返回 [{idx: 全局编号, text: 论断}]。"""
    block = render_evidence(papers)
    system = (
        "你是一名严谨的科研综述整理者。下面给出若干篇编号论文（标题、作者、年份、会议与摘要）。"
        "请从每篇论文的摘要中提取最能代表其关键贡献的论断（claim）。\n"
        f"要求：忠实于原文，不自作推断；每条论断独立成句；每条不超过"
        f" {settings.review_claim_max_chars} 字；每篇 1-3 条；没有值得提取论断的论文可以跳过。\n"
        '输出严格一个 JSON 对象，不要任何其他文字：'
        '{"papers":[{"index":<论文全局编号>,"claims":["论断1","论断2"]}]}。'
    )
    payload = {"topic": topic, "evidence": block}
    data = _structured(llm, mock, system, payload, ReviewClaims, _mock_claims(topic, papers))
    claims: list[dict] = []
    for entry in data.papers:
        idx = entry.index
        if idx < 1 or idx > len(papers):
            continue
        for text in entry.claims:
            text = str(text).strip()
            if text:
                claims.append({"idx": idx, "text": _short(text, settings.review_claim_max_chars)})
    if not claims:
        raise RuntimeError("论断提取为空：模型未从任何论文中提取出论断。")
    return claims


# --------------------------------------------------------------------------- #
# 阶段二：论断聚类成维度（含漏归论文补聚类，维护全分划不变式）
# --------------------------------------------------------------------------- #
def _mock_cluster(topic: str, claims: list[dict], n_papers: int) -> dict:
    """确定性聚类：按全局编号均分到固定维度名（不足 3 个维度时按需截断）。"""
    idxs = sorted({c["idx"] for c in claims})
    k = min(len(_MOCK_DIMENSIONS), len(idxs))
    if k == 0:
        return {"dimensions": []}
    per = max(1, -(-len(idxs) // k))
    dimensions = []
    for d in range(k):
        group = idxs[d * per : (d + 1) * per]
        if group:
            dimensions.append({"name": _MOCK_DIMENSIONS[d], "format": "该维度覆盖的核心讨论角度", "paper_indices": group})
    return {"dimensions": dimensions}


def cluster_claims(llm: LLMProvider, mock: bool, topic: str, claims: list[dict], n_papers: int) -> list[dict]:
    """阶段二：把论断聚类成研究维度，返回 [{name, format, paper_indices}]。"""
    valid = {c["idx"] for c in claims}
    claim_lines = "\n".join(f"[{c['idx']}] {c['text']}" for c in claims)
    lo, hi = settings.review_dimensions_min, settings.review_dimensions_max
    system = (
        "你是一名科研综述的结构设计师。下面是从若干论文摘要提取的关键论断，"
        "每条标注其来源论文的全局编号。请把论断按研究维度聚类，作为综述的组织结构。\n"
        "要求：\n"
        f"- 维度数量在 {lo}–{hi} 之间；\n"
        "- 每个维度用一句话说明其讨论角度（format 字段）；\n"
        "- 每篇论文（连同其论断）只归入一个维度，不同维度角度不重叠；\n"
        "- 所有出现过的论文编号都必须被归入某个维度。\n"
        '输出严格一个 JSON 对象，不要任何其他文字：'
        '{"dimensions":[{"name":"维度名","format":"一句话说明",'
        '"paper_indices":[<全局论文编号>,...]}]}。'
    )
    payload = {"topic": topic, "claims": claim_lines}
    data = _structured(llm, mock, system, payload, ReviewCluster, _mock_cluster(topic, claims, n_papers))

    dims: list[dict] = []
    for d in data.dimensions:
        name = str(d.name).strip()
        if not name:
            continue
        indices = _clean_numbers(d.paper_indices, n_papers)
        indices = [n for n in indices if n in valid]
        if indices:
            dims.append({"name": name, "format": str(d.format or "").strip(), "paper_indices": indices})
    if len(dims) > hi:
        log.info("聚类维度 %d 个，硬性截断到 %d。", len(dims), hi)
        dims = dims[:hi]
    if len(dims) < lo:
        log.info("聚类维度仅 %d 个，低于 review_dimensions_min=%d（min 是目标非硬约束）。", len(dims), lo)

    covered = {n for d in dims for n in d["paper_indices"]}
    uncovered = valid - covered
    if uncovered:
        _cluster_uncovered(llm, mock, topic, claims, dims, uncovered)
        covered = {n for d in dims for n in d["paper_indices"]}
        still = valid - covered
        if still:
            raise RuntimeError(f"聚类覆盖不变式被破坏：仍有 {len(still)} 篇论文未归入任何维度。")
    if not dims:
        raise RuntimeError("聚类为空：模型未产出任何有效维度。")
    return dims


def _cluster_uncovered(llm: LLMProvider, mock: bool, topic: str, claims: list[dict],
                       dims: list[dict], uncovered: set[int]) -> None:
    """补聚类：把首次聚类漏归的论文定向归入已有维度，必要时新建维度。"""
    text_of: dict[int, str] = {}
    for c in claims:
        text_of.setdefault(c["idx"], c["text"])
    lines = "\n".join(f"[{n}] {text_of[n]}" for n in sorted(uncovered) if n in text_of)
    if not lines:
        return
    dim_choices = "\n".join(f"{i}. {d['name']}（{d['format']}）" for i, d in enumerate(dims))
    hi = settings.review_dimensions_max
    system = (
        "你是一名科研综述的结构设计师。聚类时下列论文漏归了维度。\n"
        "请把每篇论文归入上面一个现有维度（按讨论角度最匹配）；"
        "仅当某篇论文确实不属于任何现有维度时，才为它新建一个维度。\n"
        f"维度总数上限 {hi} 个，不要超限。\n"
        "输出严格一个 JSON 对象，不要任何其他文字："
        '{"assignments":[{"index":<漏归论文编号>,"dimension":<现有维度序号(0 基)或新维度名>}]}。'
    )
    payload = {"topic": topic, "dimensions": dim_choices, "unassigned_claims": lines}
    mock_data = {"assignments": [{"index": n, "dimension": 0} for n in sorted(uncovered)]}
    data = _structured(llm, mock, system, payload, ReviewAssignments, mock_data)

    for a in data.assignments:
        n = a.index
        if n not in uncovered:
            continue
        ref = a.dimension
        target_idx: int | None = None
        new_name: str | None = None
        if isinstance(ref, int):
            target_idx = ref
        elif isinstance(ref, str):
            s = ref.strip()
            if s.isdigit():
                target_idx = int(s)
            elif s:
                new_name = s
        if target_idx is not None and 0 <= target_idx < len(dims):
            dims[target_idx]["paper_indices"].append(n)
        elif new_name:
            found = next((d for d in dims if d["name"] == new_name), None)
            if found is not None:
                found["paper_indices"].append(n)
            elif len(dims) < hi:
                dims.append({"name": new_name, "format": "", "paper_indices": [n]})


# --------------------------------------------------------------------------- #
# 阶段三：开篇摘要 + 逐维度成文（散文，节末「### 要点」）
# --------------------------------------------------------------------------- #
def _dim_claim_lines(dim: dict, claims_by_idx: dict[int, list[str]]) -> str:
    lines = []
    for n in dim["paper_indices"]:
        for text in claims_by_idx.get(n, []):
            lines.append(f"[{n}] {text}")
    return "\n".join(lines)


def _write_front(llm: LLMProvider, mock: bool, topic: str, dims: list[dict]) -> str:
    """开篇「## 摘要」：背景 + 总体判断 + 预告维度（一次散文调用）。"""
    dim_lines = "\n".join(f"- {d['name']}" + (f"：{d['format']}" if d["format"] else "") for d in dims)
    system = (
        "你是一名资深科研综述作者。下面给出研究主题与综述将展开的若干研究维度，"
        "请撰写综述的开篇「## 摘要」小节（2-3 段）：\n"
        "- 开门见山交代研究背景与主题价值；\n"
        "- 预告综述将展开的维度（下面给出的维度列表就是综述的全部章节，"
        "请严格按此预告，不要虚构其他章节）；\n"
        "- 给出总体判断。\n"
        "写作风格：像读完一摞论文后自己组织观点的人，而不是照清单念条目；"
        "变换句子的开头与句式，避免「近年来…」「首先…其次…最后…」这类套话。\n"
        "只输出「## 摘要」小节本身，不要输出维度正文，不要写「参考文献」章节。"
    )
    user = f"主题：{topic}\n\n综述将按以下维度展开：\n{dim_lines}\n\n请撰写「## 摘要」。"
    if mock:
        return (
            "## 摘要\n\n"
            f"围绕“{topic}”，已有研究在方法设计、实验评测与未来挑战等方向上持续积累，"
            "形成了从早期核心机制验证到规模化应用部署的演进脉络。\n\n"
            "本综述从以下维度梳理该方向的研究进展："
            + "、".join(d["name"] for d in dims)
            + "，并结合代表性文献的贡献与局限给出对比分析。"
            "总体来看，该方向仍处于快速迭代期，评测标准与跨场景泛化是当前最突出的开放问题。"
        )
    text = (llm.chat_text(system, user) or "").strip()
    if not text:
        return ""
    if not text.lstrip().startswith("##"):
        text = "## 摘要\n\n" + text
    return text


def _synthesize_dim(llm: LLMProvider, mock: bool, topic: str, dim: dict,
                    claims_by_idx: dict[int, list[str]], already_written: str) -> str:
    """阶段三（单维度）：一次散文调用，只显示本维度论断但带全局编号。"""
    claim_lines = _dim_claim_lines(dim, claims_by_idx)
    if not claim_lines:
        log.info("维度「%s」无论断，跳过该节。", dim["name"])
        return ""
    system = (
        "你是一名资深科研综述作者。根据给定主题与某一研究维度的编号论断，"
        "撰写该维度的综述正文。\n\n"
        "写作风格：\n"
        "- 像读完一摞论文后自己组织观点的人，而不是照清单念条目：按方法的相似与差异、"
        "观点的先后与冲突来组织内容，不要把论断一篇篇罗列。\n"
        "- 变换句子的开头与句式，避免「近年来…」「首先…其次…最后…」这类套话。\n"
        "- 引用放在论断自然结束的地方即可，如「……在开放域问答上表现更稳[1][2]」；"
        "支持同一论断的多个来源合并写为 [1][2]；背景常识、过渡句可以不带引用。\n\n"
        "约束：\n"
        "- 只引用上面给出的编号（全局编号 1..N），不要编造编号。\n"
        "- 上面给出的所有论断都应被讨论并在正文中得到体现（可合并论述、对比异同），不要遗漏；\n"
        "- 不要写「参考文献」或「References」章节。\n"
        "- 用 2-4 段组织该维度正文，语言精炼、有综述感。\n"
        "- 在该维度正文末尾用「### 要点」小标题，列出 2-3 条要点，"
        "每条一行，末尾标注支撑论文编号。\n"
        "- 如果提供了「已写过的其他维度正文」，不要重复其中的论断与表述。"
    )
    user = (
        f"主题：{topic}\n\n"
        f"维度：{dim['name']}（{dim['format']}）\n\n"
        f"以下是本维度的编号论断（[n] 为来源论文全局编号）：\n\n{claim_lines}\n\n"
        "请撰写该维度正文。"
    )
    if already_written:
        user += f"\n\n以下是已写过的其他维度正文，避免与之重复：\n\n{already_written}"

    if mock:
        idxs = dim["paper_indices"]
        claim_texts = {n: claims_by_idx.get(n, [""])[0] for n in idxs}
        body = (
            f"围绕“{dim['name']}”，已有研究从多个角度展开探索。"
            + "".join(
                f"文献 [{n}] 的核心贡献在于{_short(claim_texts.get(n, ''), 50)}。"
                for n in idxs
            )
            + "综合来看，本维度呈现出从方法验证到系统化评测的演进趋势，"
            "后续研究应着力于评测口径的统一与真实场景的泛化验证。"
        )
        points = []
        if idxs:
            keys = idxs[:2]
            points.append(f"- 该维度的核心方法与结论相互印证：[{']['.join(str(x) for x in keys)}] 等工作奠定了讨论基础。")
        if len(idxs) >= 3:
            keys = idxs[2:4]
            points.append(f"- 实验与评测呈现互补证据：[{']['.join(str(x) for x in keys)}] 提供了对比基准。")
        points.append("- 开放问题：评测标准不统一、跨场景泛化仍待解决，是后续研究的重要切入点。")
        return f"{body}\n\n### 要点\n" + "\n".join(points)
    return llm.chat_text(system, user)


# --------------------------------------------------------------------------- #
# 质量 passes（对齐 SZDR passes.py，按配置门控；数据前置条件不满足则跳过）
# --------------------------------------------------------------------------- #
_REFERENCES_TAIL = re.compile(r"\n##\s*参考文献[\s\S]*$")


def _strip_references_tail(markdown: str) -> str:
    """剔除文末「## 参考文献」节（修订/重排时先剥掉，文末参考文献由渲染层统一生成）。"""
    return _REFERENCES_TAIL.sub("", markdown).strip()


def _run_passes(llm: LLMProvider, mock: bool, markdown: str, refs: list[dict]) -> list[str]:
    """运行配置门控的质量 passes；passes 是增强项，单个失败只记日志并跳过。"""
    passes_out: list[str] = []
    if settings.review_pass_findings:
        try:
            s = findings_panel(llm, mock, refs)
            if s:
                passes_out.append(s)
        except Exception as exc:
            log.warning("核心发现面板失败，跳过: %s", exc)
    if settings.review_pass_table:
        try:
            s = comparison_table(llm, mock, markdown, refs)
            if s:
                passes_out.append(s)
        except Exception as exc:
            log.warning("对比表失败，跳过: %s", exc)
    if settings.review_pass_timeline:
        try:
            s = timeline(llm, mock, refs)
            if s:
                passes_out.append(s)
        except Exception as exc:
            log.warning("研究脉络时间线失败，跳过: %s", exc)
    return passes_out


def _assemble_final(markdown: str, passes_out: list[str], refs: list[dict]) -> str:
    """组装最终文档：正文 + passes + 文末参考文献（参考文献永远在最后）。"""
    parts = [markdown.rstrip()]
    if passes_out:
        parts.append("\n\n".join(passes_out))
    references = render_references(refs)
    if references:
        parts.append(references.rstrip())
    return "\n\n".join(p for p in parts if p) + "\n"


def _evidence(refs: list[dict]) -> str:
    return render_evidence(refs)


def _strength_label(count: int) -> str:
    if count >= 3:
        return "多源共识"
    if count == 2:
        return "部分共识"
    return "单源"


def findings_panel(llm: LLMProvider, mock: bool, refs: list[dict]) -> str:
    """核心发现面板：一次结构化调用，条目带来源编号 / 分歧标记 / 共识强度。"""
    if not refs:
        log.info("核心发现面板：参考文献为空，跳过。")
        return ""
    block = _evidence(refs)
    k = settings.review_findings_k
    system = (
        "你是一名资深科研综述作者。下面给出若干篇编号论文（标题、作者、年份与摘要），"
        "请提炼全篇最值得读者先知道的若干条核心发现。\n\n"
        "要求：\n"
        "- 每条发现独立成句、信息密度高，不要背景套话；\n"
        "- 每条标注支持它的论文编号 sources；不要把同一发现拆成多条，"
        "支持同一发现的多篇论文合并写进 sources；\n"
        "- 若文献对这条发现存在分歧（不同论文结论相互矛盾），把 conflict 置为 true，"
        "否则为 false。\n"
        f"- 只输出前 {k} 条最重要的发现。\n"
        '输出严格一个 JSON 对象，不要任何其他文字：'
        '{"findings":[{"claim":"发现","sources":[<论文编号>,...],'
        '"conflict":true|false}]}。'
    )
    payload = {"evidence": block}
    mock_data = {
        "findings": [
            {
                "claim": f"代表性工作（如 {_short(p.get('title') or '', 40)}）推动了该方向的关注度与研究投入",
                "sources": [i],
                "conflict": False,
            }
            for i, p in enumerate(refs[:k], 1)
        ]
    }
    data = _structured(llm, mock, system, payload, ReviewFindings, mock_data)
    items = []
    for f in data.findings[:k]:
        claim = str(f.claim or "").strip()
        if not claim:
            continue
        sources = _clean_numbers(f.sources, len(refs))
        if not sources:
            log.info("核心发现「%s」无有效来源编号，丢弃。", claim[:40])
            continue
        strength = _strength_label(len(sources))
        conflict = _as_bool(f.conflict)
        suffix = "（文献存在分歧）" if conflict else ""
        items.append(f"- **{claim}**[{']['.join(str(s) for s in sources)}] — {strength}{suffix}")
    if not items:
        log.info("核心发现面板：模型未产出任何有效发现，跳过。")
        return ""
    return "## 核心发现\n\n" + "\n".join(items)


def _cell(s: str) -> str:
    """Markdown 表单元格清洗：折叠换行、转义竖线。"""
    return str(s).replace("|", "\\|").replace("\n", " ").strip()


def _table_title(n: int, title: str, width: int = 40) -> str:
    """对比表首列标签：完整保留标题，超宽时按词边界 <br> 折行，绝不截断丢字符。"""
    t = str(title).replace("|", "\\|").strip()
    if len(t) <= width:
        return f"[{n}] {t}"
    chunks, rest = [], t
    while len(rest) > width:
        cut = width
        space = rest.rfind(" ", 0, width)
        if space > width // 2:
            cut = space
        chunks.append(rest[:cut])
        rest = rest[cut:].lstrip()
    chunks.append(rest)
    return f"[{n}] " + "<br>".join(chunks)


def _citation_freq(markdown: str, total: int) -> dict[int, int]:
    """统计正文中每个 [n] 的出现频次（对比表选样：取最被讨论的论文）。"""
    return {n: len(re.findall(rf"\[{n}\]", markdown)) for n in range(1, total + 1)}


def _mock_table(markdown: str, refs: list[dict]) -> dict:
    """确定性填值：从摘要截取短片段作为各属性取值。"""
    chosen = list(range(1, len(refs) + 1))
    if len(refs) > settings.review_table_max_refs:
        freq = _citation_freq(markdown, len(refs))
        chosen = sorted(sorted(range(1, len(refs) + 1), key=lambda n: -freq.get(n, 0))[: settings.review_table_max_refs])
    rows = []
    for n in chosen:
        p = refs[n - 1]
        abstract = str(p.get("abstract") or "").strip().replace("\n", " ")
        values = {
            "技术路线": _short(abstract, 10) or "N/A",
            "核心机制": _short(abstract, 10) or "N/A",
            "评测数据": "N/A",
            "主要结论": _short(abstract, 10) or "N/A",
        }
        rows.append({"index": n, "values": values})
    return {"rows": rows}


def comparison_table(llm: LLMProvider, mock: bool, markdown: str, refs: list[dict]) -> str:
    """自动对比表：提属性 → 填值 → 一致性 format pass（三次调用）。"""
    if len(refs) < settings.review_table_min_refs:
        log.info("对比表：参考文献仅 %d 篇（需 ≥%d），跳过。", len(refs), settings.review_table_min_refs)
        return ""
    chosen = list(range(1, len(refs) + 1))
    if len(refs) > settings.review_table_max_refs:
        freq = _citation_freq(markdown, len(refs))
        chosen = sorted(
            sorted(range(1, len(refs) + 1), key=lambda n: -freq.get(n, 0))[: settings.review_table_max_refs]
        )
        log.info("对比表：参考文献 %d 篇超上限 %d，按正文引用频次取 %d 篇。", len(refs), settings.review_table_max_refs, len(chosen))
    table_refs = [refs[n - 1] for n in chosen]
    block = render_evidence(table_refs)

    attrs_system = (
        "你是一名科研综述作者。下面给出若干篇编号论文，请提出若干个适合横向对比的"
        "可比属性，用于做一张对比表。\n"
        "要求：属性必须是论文内容层面的可比维度（如方法、评估数据集、规模、"
        "主要结论、局限等），不要元数据（标题、作者、年份、会议、DOI、编号）；"
        "优先选择摘要普遍能回答的属性（方法/技术路线、核心机制、评估数据集/任务、"
        "主要结论），避免某属性大多数论文都填不出而整列 N/A。\n"
        "给出 3-6 个属性。\n"
        '输出严格一个 JSON 对象，不要任何其他文字：{"attributes":["属性1","属性2",...]}。'
    )
    attrs_data = _structured(
        llm, mock, attrs_system, {"evidence": block}, ReviewAttributes,
        {"attributes": _MOCK_TABLE_ATTRS},
    )
    attributes = [str(a).strip() for a in attrs_data.attributes if str(a).strip()]
    if not attributes:
        log.info("对比表：模型未提出任何可比属性，跳过。")
        return ""

    fill_system = (
        "你是严谨的表格填写员。下面给出若干篇编号论文与一组可比属性，"
        "请为每一篇论文填写每个属性的取值。\n"
        "要求：\n"
        "- 每个取值不超过 10 个词，简洁；\n"
        "- 取值必须从对应编号论文的摘要中提取并概括，用中文撰写，"
        "不要照抄摘要原文（尤其不要夹带英文片段）；\n"
        "- 仅当摘要中完全未提及某属性时才填 N/A，尽量让每列都填得上；\n"
        "- 每篇论文都必须有对应行，编号与输入一致。\n"
        '输出严格一个 JSON 对象，不要任何其他文字：'
        '{"rows":[{"index":<论文编号>,"values":{"<属性>":"<取值>",...}}]}。'
    )
    fill_user = (
        f"编号论文：\n\n{block}\n\n可比属性：" + "、".join(attributes)
    )
    fill_data = _structured(llm, mock, fill_system, {"evidence": block, "attributes": attributes},
                            ReviewTable, _mock_table(markdown, refs))

    compact = []
    for row in fill_data.rows:
        if row.index < 1 or row.index > len(refs):
            continue
        cells = []
        for a in attributes:
            v = row.values.get(a)
            cells.append(f"{a}: {'N/A' if v in (None, '') else _cell(v)}")
        compact.append(f"[{row.index}] " + " | ".join(cells))
    if not compact:
        log.info("对比表：填值阶段未产出任何有效行，跳过。")
        return ""
    compact_text = "\n".join(compact)

    fmt_system = (
        "下面是逐篇论文的对比表内容。请检查各属性的取值格式是否一致"
        "（同一属性下单位、术语、标点、大小写统一；缺失统一为 N/A），"
        "修正不一致之处，原样保留数值与编号。\n"
        '输出严格一个 JSON 对象，不要任何其他文字：'
        '{"rows":[{"index":<论文编号>,"values":{"<属性>":"<取值>",...}}]}。'
    )
    fmt_data = _structured(llm, mock, fmt_system, {"rows": compact_text}, ReviewTable, _mock_table(markdown, refs))

    rows: dict[int, dict[str, str]] = {}
    for row in fmt_data.rows:
        if row.index < 1 or row.index > len(refs):
            continue
        vals = {}
        for a in attributes:
            v = row.values.get(a)
            vals[a] = "N/A" if v in (None, "") else _cell(v)
        rows[row.index] = vals
    if not rows:
        log.info("对比表：一致性 pass 后仍无有效行，跳过。")
        return ""

    lines = ["## 对比表", "", "| 论文 | " + " | ".join(attributes) + " |",
             "| " + " | ".join(["---"] * (1 + len(attributes))) + " |"]
    for n in chosen:
        vals = rows.get(n)
        if vals is None:
            continue
        lines.append("| " + _table_title(n, refs[n - 1].get("title") or "Untitled") + " | "
                     + " | ".join(vals[a] for a in attributes) + " |")
    return "\n".join(lines)


def _zh_num(i: int) -> str:
    numerals = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"]
    if 1 <= i <= len(numerals):
        return numerals[i - 1]
    return str(i)


def timeline(llm: LLMProvider, mock: bool, refs: list[dict]) -> str:
    """研究脉络时间线：可解析年份的 refs 升序，一次结构化调用分阶段。"""
    dated: list[tuple[int, int]] = []
    for i, p in enumerate(refs, 1):
        try:
            year = int(str(p.get("year") or "")[:4])
        except (TypeError, ValueError):
            continue
        if 1000 <= year <= 9999:
            dated.append((i, year))
    if len(dated) < 2:
        log.info("时间线：可解析年份的参考文献仅 %d 篇（需 ≥2），跳过。", len(dated))
        return ""
    dated.sort(key=lambda t: t[1])
    span = f"{dated[0][1]}-{dated[-1][1]}"
    by_year = "\n".join(f"[{n}] {refs[n - 1].get('title') or 'Untitled'} ({y})" for n, y in dated)

    system = (
        "你是科研脉络梳理者。下面是按年份升序排列的编号论文（[n] 标题 (年份)）。"
        "请把时间跨度划分为若干研究阶段，作为综述的研究脉络。\n"
        f"- 阶段数不超过 {settings.review_timeline_max_phases}，阶段按时间升序、互不重叠；\n"
        "- 每个阶段给出名称与起止年份；\n"
        "- 把每篇论文归入其年份所属的阶段（每篇恰好一个阶段）。\n"
        '输出严格一个 JSON 对象，不要任何其他文字：'
        '{"phases":[{"name":"阶段名","start":<起始年>,"end":<结束年>,"papers":[<论文编号>,...]}]}。'
    )
    # mock：按年份均分到最多 max_phases 个阶段（阶段名由渲染层「阶段N」前缀承担，避免重复）
    max_phases = settings.review_timeline_max_phases
    k = min(max_phases, len(dated))
    mock_phases = []
    for d in range(k):
        lo = d * len(dated) // k
        hi = (d + 1) * len(dated) // k if d < k - 1 else len(dated)
        group = dated[lo:hi]
        if group:
            mock_phases.append({
                "name": "",
                "start": group[0][1],
                "end": group[-1][1],
                "papers": [n for n, _ in group],
            })
    data = _structured(llm, mock, system, {"papers": by_year}, ReviewTimeline, {"phases": mock_phases})

    year_of = {n: y for n, y in dated}
    phases: list[tuple[int, int, str, list[int]]] = []
    for ph in data.phases[:max_phases]:
        start, end = ph.start, ph.end
        name = str(ph.name or "").strip()
        if start > end:
            continue
        papers = []
        for n in _clean_numbers(ph.papers, len(refs)):
            if n not in year_of:
                continue
            if not (start <= year_of[n] <= end):
                log.info("时间线：论文 [%d] 年份 %d 不在阶段 %d-%d 内，丢弃。", n, year_of[n], start, end)
                continue
            papers.append(n)
        if papers:
            phases.append((start, end, name, papers))
    if not phases:
        log.info("时间线：模型未产出任何有效阶段，跳过。")
        return ""
    phases.sort(key=lambda t: t[0])

    blocks = [f"## 研究脉络（{span}）"]
    for i, (start, end, name, papers) in enumerate(phases, 1):
        head = f"### 阶段{_zh_num(i)}（{start}–{end}）"
        if name:
            head += f"：{name}"
        block = [head]
        for n in papers:
            block.append(f"- [{n}] {refs[n - 1].get('title') or 'Untitled'}（{year_of[n]}）")
        blocks.append("\n".join(block))
    return "\n\n".join(blocks)


# --------------------------------------------------------------------------- #
# 唯一入口
# --------------------------------------------------------------------------- #
def build_literature_review(llm: LLMProvider, mock: bool, topic: str, paper_ids: list[str]) -> tuple[str, list[dict]]:
    """生成完整文献综述 Markdown（含「## 参考文献」），返回 (markdown, 实际引用论文列表)。

    - 无可用论文时返回占位文档（不抛异常，保证 agent 流程不中断）；
    - 三阶段综合 + 质量 passes 全部走同一代码路径，mock 模式下各步确定性回退。
    """
    papers = _load_papers(paper_ids)
    if not papers:
        log.warning("综述「%s」无可用论文，返回占位文档。", topic)
        return f"# {topic}：文献综述\n\n> 当前论文库未检索到可用文献，请先完成论文检索后再生成综述。\n", []

    # 阶段一：逐篇提取论断
    claims = extract_claims(llm, mock, topic, papers)
    # 阶段二：聚类成维度（含补聚类）
    dims = cluster_claims(llm, mock, topic, claims, len(papers))

    claims_by_idx: dict[int, list[str]] = {}
    for c in claims:
        claims_by_idx.setdefault(c["idx"], []).append(c["text"])

    # 阶段三：开篇摘要 + 逐维度成文
    front = _write_front(llm, mock, topic, dims)
    sections: list[str] = [f"# {topic}：文献综述", front]
    already = ""
    for dim in dims:
        body = _synthesize_dim(llm, mock, topic, dim, claims_by_idx, already)
        if body:
            sections.append(f"## {dim['name']}" + (f"（{dim['format']}）" if dim["format"] else "") + "\n\n" + body)
            already = already + "\n\n" + body if already else body

    markdown = "\n\n".join(s for s in sections if s)

    # 引用解析：全局编号 [n] → 首次出现重编号 + 悬空剔除（此时正文尚无参考文献节）
    markdown, refs = resolve_citations(markdown, papers)
    if not refs:
        log.warning("综述「%s」正文未产生任何引用，跳过参考文献节。", topic)

    # 质量 passes（按配置门控，均在已解析的最终参考文献上运行，编号 1..M）
    passes_out = _run_passes(llm, mock, markdown, refs)
    return _assemble_final(markdown, passes_out, refs), refs


def revise_literature_review(llm: LLMProvider, mock: bool, topic: str,
                             markdown: str, feedback: str, paper_ids: list[str]) -> str:
    """修订文献综述：按 critic 审稿意见定向改写正文（不重新聚类/提取论断），
    随后重新校验引用并重跑质量 passes，最后重排文末参考文献。

    - 无审稿意见或 mock 模式 → 原样返回（mock 修订为确定性无操作）；
    - 真实模式：一次散文调用改写全文正文（剥掉文末参考文献节后再写），
      要求保持未被反馈涉及的原文逐字不变；
    - 修订后引用重新解析（新增/删除引用会触发重编号与悬空剔除），
      质量 passes 一并重跑，保证编号与参考文献始终一致。
    """
    if mock or not (feedback or "").strip():
        log.info("修订「%s」：mock 模式或无审稿意见，返回原文。", topic)
        return markdown
    papers = _load_papers(paper_ids)
    if not papers:
        log.warning("修订「%s」无可用论文，返回原文。", topic)
        return markdown
    body = _strip_references_tail(markdown)

    system = (
        "你是一名资深科研综述作者。下面是待修订的综述正文与审稿意见，"
        "请按审稿意见修订综述。\n\n"
        "要求：\n"
        "- 只修改审稿意见指出的问题；未被反馈涉及的段落、句子与引用编号逐字保留，不得改写；\n"
        "- 保持原有章节结构与「### 要点」小节；\n"
        "- 引用保持全局编号 [n] 不变，只引用正文原有的编号，不要编造新编号；\n"
        "- 不要输出「## 参考文献」章节（系统会重新生成）；\n"
        "- 不要加「修订说明」等元注释，只输出修订后的综述正文本身（从标题开始）。\n"
        "- 写作风格：像读完一摞论文后自己组织观点的人，变换句子开头与句式，"
        "避免「近年来…」「首先…其次…最后…」这类套话。"
    )
    user = (
        f"主题：{topic}\n\n审稿意见：\n{feedback}\n\n"
        f"以下是待修订的综述正文：\n\n{body}\n\n请按审稿意见输出修订后的完整正文。"
    )
    revised = (llm.chat_text(system, user) or "").strip()
    if not revised:
        log.warning("修订「%s」：LLM 未返回修订正文，保留原文。", topic)
        return markdown

    revised, refs = resolve_citations(revised, papers)
    if not refs:
        log.warning("修订「%s」正文未产生任何引用，跳过参考文献节。", topic)
    passes_out = _run_passes(llm, mock, revised, refs)
    return _assemble_final(revised, passes_out, refs)
