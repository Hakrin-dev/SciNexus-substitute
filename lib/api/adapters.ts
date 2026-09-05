/**
 * 后端响应 → 前端类型适配层。
 *
 * 新版 Next.js 后端已在 Route Handler 内完成大部分视觉字段派生（venueTone / initials /
 * avatarColor / badges / metaRows 等），故这里只保留：
 *  1. 后端契约类型（BackendXxx，作为接口契约文档与类型标注）；
 *  2. 视觉派生工具（ccfTone / initials / deadlineOffsetMs 等，供 mock 数据与边缘场景复用）；
 *  3. 归一化转换（toXxx，兜底空值，供后端返回数据字段时使用）。
 */
import type {
  FeedPaper,
  PaperDetail,
  Publication,
  Venue,
  VenueBadgeName,
  VenueMetaIcon,
} from "@/types";

// ==================== 后端契约类型 ====================

export interface BackendPaper {
  id: string;
  title: string;
  authors: string;
  author_list?: string[];
  affiliation?: string | null;
  venue: string;
  ccf?: string | null;
  year?: number | null;
  date?: string | null;
  abstract: string;
  tags?: string[];
  citations: number;
  doi?: string | null;
  relevance?: number | null;
  keywords?: string[];
  subjects?: string[];
  knowledgeScore?: number | null;
  rank?: number | null;
  source?: "remote_knowledge_base" | "local" | "hybrid" | string;
  fallbackUsed?: boolean;
}

export interface BackendVenue {
  id: string;
  abbr: string;
  kind: "conference" | "journal";
  fullName: string;
  ccf?: string | null;
  deadline?: string | null | Venue["deadline"];
  deadlineLabel?: string | null;
  urgent?: boolean;
  rate?: number | null;
  submissions?: number | null;
  domain?: string | null;
  location?: string | null;
  badges?: VenueBadgeName[] | null;
  metaRows?: Venue["metaRows"] | null;
  chips?: string[] | null;
  accent?: Venue["accent"] | null;
  matchPct?: number | null;
  matchClass?: string | null;
  matchReason?: string | null;
}

export interface BackendMatchedVenue extends BackendVenue {
  matchPct?: number | null;
  matchClass?: string | null;
  matchReason?: string | null;
}

export interface BackendPublication extends Publication {}

export interface BackendScholarDetail {
  id: string;
  location: string;
  email: string;
  bio: string[];
  introTags: string[];
  metrics: { totalCitations: string; hIndex: number; i10Index: number };
  yearlyCitations: {
    years: string[];
    values: number[];
    highlight: string;
  };
  links: string[];
  toc: { id: string; label: string; active?: boolean }[];
  publications: BackendPublication[];
}

// ==================== 视觉派生工具 ====================

/** CCF → 卡片音调（论文卡/文献库 PDF 色块共用） */
export function ccfTone(ccf?: string | null): "violet" | "amber" | "green" {
  if (ccf === "A") return "violet";
  if (ccf === "B") return "amber";
  return "green";
}

/** 名称 → 首字母缩写（英文取各词首字母，中文取前两字） */
export function initials(name: string): string {
  const words = (name ?? "")
    .split(/[\s·\-–—/]+/)
    .filter((w) => /[\p{L}\p{N}]/u.test(w));
  if (!words.length) return "?";
  if (words.length === 1) {
    const w = words[0];
    return /[\u4e00-\u9fff]/.test(w) ? w.slice(0, 2) : w.slice(0, 2).toUpperCase();
  }
  return words.slice(0, 3).map((w) => w[0]).join("").toUpperCase();
}

/** "2024-11-15" → 距现在的毫秒偏移（倒计时演示用，过期归零） */
function deadlineOffsetMs(deadline?: string | null): number {
  if (!deadline) return 0;
  const t = Date.parse(deadline);
  if (Number.isNaN(t)) return 0;
  return Math.max(0, t - Date.now());
}

// ==================== 归一化转换（兜底空值） ====================

export function toFeedPaper(p: BackendPaper): FeedPaper {
  const year = typeof p.year === "number" && Number.isFinite(p.year) ? p.year : null;
  const citations = typeof p.citations === "number" && Number.isFinite(p.citations) ? p.citations : 0;
  const date = p.source === "remote_knowledge_base" && year && p.date === `${year}-01-01`
    ? String(year)
    : p.date ?? (year ? String(year) : "");
  return {
    id: p.id,
    // 远程 API 只有年份时，不伪造为精确到 1 月 1 日的日期。
    date,
    venue: p.venue || "arXiv",
    venueTone: ccfTone(p.ccf),
    authors: p.authors || "未提供作者",
    title: p.title,
    abstract: p.abstract || "",
    aiLink: "AI 深度解读",
    tags: p.tags ?? [...(p.keywords ?? []), ...(p.subjects ?? [])],
    likes: 0,
    citations,
    source: p.source,
    rank: typeof p.rank === "number" && Number.isFinite(p.rank) ? p.rank : null,
    knowledgeScore: typeof p.knowledgeScore === "number" && Number.isFinite(p.knowledgeScore) ? p.knowledgeScore : null,
    fallbackUsed: p.fallbackUsed === true,
    thumb: p.venue || p.tags?.[0] || "论文",
  };
}

export function toVenue(v: BackendVenue): Venue {
  const derivedBadges: VenueBadgeName[] = [];
  if (v.ccf) derivedBadges.push(`CCF ${v.ccf}` as VenueBadgeName);

  const derivedMetaRows: [VenueMetaIcon, string][][] = [];
  const row: [VenueMetaIcon, string][] = [];
  if (v.domain) row.push(["folder", v.domain]);
  if (v.rate != null) row.push(["chart", `录用率: ${v.rate}%`]);
  if (v.location) row.push(["pin", v.location]);
  if (typeof v.deadline === "string") row.push(["cal", v.deadline]);
  if (row.length) derivedMetaRows.push(row);

  const shapedDeadline =
    typeof v.deadline === "object" && v.deadline !== null
      ? v.deadline
      : undefined;
  const rawDeadline = typeof v.deadline === "string" ? v.deadline : undefined;

  return {
    id: v.id,
    kind: v.kind,
    abbr: v.abbr,
    fullName: v.fullName,
    badges: Array.isArray(v.badges) ? v.badges : derivedBadges,
    metaRows: Array.isArray(v.metaRows) ? v.metaRows : derivedMetaRows,
    chips: Array.isArray(v.chips) ? v.chips : v.domain ? [v.domain] : [],
    accent: v.accent === "danger" || v.accent === "success"
      ? v.accent
      : v.urgent
        ? "danger"
        : "success",
    deadline: shapedDeadline ?? (rawDeadline
      ? {
          label: v.deadlineLabel ?? "截稿",
          dateText: rawDeadline,
          offsetMs: deadlineOffsetMs(rawDeadline),
        }
      : undefined),
  };
}

/** 外部 API 场馆记录补齐 VenueCard 所需的视觉字段，同时保留匹配分数等扩展数据。 */
export function normalizeVenues<T extends BackendVenue>(items: T[]): Array<T & Venue> {
  return items.map((item) => ({ ...item, ...toVenue(item) }));
}

export function toPaperDetail(
  p: BackendPaper,
  id: string,
  fulltext?: { chunks?: { page: number; text: string }[] } | null,
): PaperDetail {
  const chunks = fulltext?.chunks ?? [];
  const intro =
    chunks.find((c) => c.page === 1)?.text?.slice(0, 600) || p.abstract || "";
  const totalPage = chunks.length
    ? Math.max(...chunks.map((c) => c.page))
    : 1;
  const rawAuthors: unknown = (p as any).author_list ?? p.authors;
  const authors: string[] = Array.isArray(rawAuthors)
    ? (rawAuthors as string[])
    : [String(rawAuthors || "佚名")];
  return {
    id: p.id || id,
    title: p.title,
    authors,
    affiliation: p.affiliation ?? "知识底座未提供机构信息",
    likes: 0,
    page: { current: 1, total: totalPage },
    toc: chunks.length
      ? [
          { id: "abstract", label: "摘要 Abstract", active: true },
          { id: "intro", label: "1. 引言" },
        ]
      : [{ id: "abstract", label: "摘要 Abstract", active: true }],
    abstract: p.abstract || "",
    introduction: intro,
    source: p.source,
    fallbackUsed: p.fallbackUsed === true,
    pdfUrl: typeof (p as any).pdf_url === "string" ? (p as any).pdf_url : null,
    hasFulltext: chunks.length > 0,
  };
}
