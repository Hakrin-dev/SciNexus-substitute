/**
 * 后端响应 → 前端类型适配层（前端优先，数据字段由后端对齐，视觉字段在此派生）。
 *
 * 后端契约见 backend/server/serializers.py：
 *  论文  id/title/authors/author_list/affiliation/venue/ccf/year/date/abstract/tags/citations(数字)/doi/relevance
 *  期刊  id/abbr/kind/fullName/ccf/deadline/deadlineLabel/urgent/rate/submissions/domain/location/matchPct/matchClass/matchReason
 *  文献库 id(论文id)/recordId/title/venue/authors/ccf/arxiv/addedAt/status/readingProgress/tags/folder
 */
import type {
  FeedPaper,
  GraphEdge,
  GraphNode,
  Institution,
  LibraryItem,
  PaperDetail,
  PaperGraph,
  Publication,
  Scholar,
  Venue,
  VenueBadgeName,
  VenueMetaIcon,
} from "@/types";

// ==================== 后端数据类型 ====================

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
}

export interface BackendVenue {
  id: string;
  abbr: string;
  kind: "conference" | "journal";
  fullName: string;
  ccf?: string | null;
  deadline?: string | null;
  deadlineLabel?: string | null;
  urgent?: boolean;
  rate?: number | null;
  submissions?: number | null;
  domain?: string | null;
  location?: string | null;
  matchPct?: number | null;
  matchClass?: string | null;
  matchReason?: string | null;
}

export interface BackendLibraryItem {
  id: string;
  recordId: string;
  title: string;
  venue: string;
  authors: string;
  ccf?: string | null;
  arxiv?: string | null;
  addedAt: string;
  status?: string;
  readingProgress?: number;
  tags?: string[];
  folder?: string;
}

export type BackendScholar = Omit<Scholar, "initials" | "avatarColor">;

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

export type BackendInstitution = Omit<Institution, "initials" | "logoColor">;

export interface BackendGraphNode {
  id: string;
  labelLines?: [string, string];
  weight: number;
  year: number;
  title: string;
  authors: string;
  venue: string;
  citations: string;
  abstract: string;
  paperId?: string;
  layer?: "mine" | "folder";
}

export interface BackendGraph {
  origin: BackendGraphNode;
  nodes: BackendGraphNode[];
  edges: { source: string; target: string; strength: number; crossLayer?: boolean }[];
  relatedIds: string[];
}

// ==================== 视觉派生工具 ====================

/** 头像/logo 色板（与品牌「深识」体系协调） */
const PALETTE = [
  "#002FA7", "#10B981", "#F59E0B", "#EC4899",
  "#8B5CF6", "#06B6D4", "#0E7490", "#B91C1C",
];

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

function formatAddedAt(iso?: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  if (m) return `${Number(m[2])}月${Number(m[3])}日`;
  return iso ?? "";
}

/** "2024-11-15" → 距现在的毫秒偏移（倒计时演示用，过期归零） */
function deadlineOffsetMs(deadline?: string | null): number {
  if (!deadline) return 0;
  const t = Date.parse(deadline);
  if (Number.isNaN(t)) return 0;
  return Math.max(0, t - Date.now());
}

// ==================== 实体适配 ====================

export function toFeedPaper(p: BackendPaper): FeedPaper {
  return {
    id: p.id,
    date: p.date ?? (p.year ? `${p.year}-01-01` : ""),
    venue: p.venue || "arXiv",
    venueTone: ccfTone(p.ccf),
    authors: p.authors || "佚名",
    title: p.title,
    abstract: p.abstract || "",
    aiLink: "AI 深度解读",
    tags: p.tags ?? [],
    likes: 0,
    citations: p.citations ?? 0,
    thumb: p.venue || p.tags?.[0] || "论文",
  };
}

export function toVenue(v: BackendVenue): Venue {
  const badges: VenueBadgeName[] = [];
  if (v.ccf) badges.push(`CCF ${v.ccf}` as VenueBadgeName);

  const metaRows: [VenueMetaIcon, string][][] = [];
  const row: [VenueMetaIcon, string][] = [];
  if (v.domain) row.push(["folder", v.domain]);
  if (v.rate != null) row.push(["chart", `录用率: ${v.rate}%`]);
  if (v.location) row.push(["pin", v.location]);
  if (v.deadline) row.push(["cal", v.deadline]);
  if (row.length) metaRows.push(row);

  return {
    id: v.id,
    kind: v.kind,
    abbr: v.abbr,
    fullName: v.fullName,
    badges,
    metaRows,
    chips: v.domain ? [v.domain] : [],
    accent: v.urgent ? "danger" : "success",
    deadline: v.deadline
      ? {
          label: v.deadlineLabel ?? "截稿",
          dateText: v.deadline,
          offsetMs: deadlineOffsetMs(v.deadline),
        }
      : undefined,
  };
}

export function toLibraryItem(l: BackendLibraryItem): LibraryItem {
  return {
    id: l.id,
    title: l.title,
    venue: l.venue || "arXiv",
    arxiv: l.arxiv ?? "arXiv: —",
    authors: l.authors || "佚名",
    addedAt: formatAddedAt(l.addedAt),
    pdfTone: ccfTone(l.ccf),
  };
}

export function toScholar(s: BackendScholar, index: number): Scholar {
  return {
    ...s,
    initials: initials(s.nameEn || s.nameCn),
    avatarColor: PALETTE[index % PALETTE.length],
  };
}

export function toInstitution(i: BackendInstitution, index: number): Institution {
  return {
    ...i,
    initials: initials(i.nameEn || i.nameCn),
    logoColor: PALETTE[index % PALETTE.length],
  };
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
  return {
    id: p.id || id,
    title: p.title,
    authors: p.author_list?.length ? p.author_list : [p.authors || "佚名"],
    affiliation: p.affiliation ?? "未知机构",
    likes: 0,
    page: { current: 1, total: totalPage },
    toc: [
      { id: "abstract", label: "摘要 Abstract", active: true },
      { id: "intro", label: "1. 引言" },
      { id: "related", label: "2. 相关工作" },
      { id: "method", label: "3. 方法" },
      { id: "exp", label: "4. 实验" },
      { id: "conclusion", label: "5. 结论" },
    ],
    abstract: p.abstract || "",
    introduction: intro,
  };
}

export function toGraphNode(n: BackendGraphNode): GraphNode {
  const labelLines: [string, string] = n.labelLines ?? [
    n.authors?.split(",")[0]?.trim().split(" ").pop() ?? "?",
    String(n.year),
  ];
  return {
    id: n.id,
    labelLines,
    weight: n.weight,
    year: n.year,
    title: n.title,
    authors: n.authors,
    venue: n.venue,
    citations: n.citations,
    abstract: n.abstract,
    paperId: n.paperId,
    layer: n.layer,
  };
}

export function toGraph(g: BackendGraph): PaperGraph {
  return {
    origin: toGraphNode(g.origin),
    nodes: g.nodes.map(toGraphNode),
    edges: g.edges.map(
      (e): GraphEdge => ({
        source: e.source,
        target: e.target,
        strength: e.strength,
        crossLayer: e.crossLayer,
      }),
    ),
    relatedIds: g.relatedIds ?? [],
  };
}
