/** 论文 Feed 卡片 */
export interface FeedPaper {
  id: string;
  date: string;
  venue: string;
  venueTone: "violet" | "amber" | "green";
  authors: string;
  title: string;
  abstract: string;
  aiLink: string;
  tags: string[];
  likes: number;
  citations: number;
  thumb: string;
}

/** 投稿目标(会议/期刊) */
export interface Venue {
  id: string;
  kind: "conference" | "journal";
  abbr: string;
  fullName: string;
  badges: VenueBadgeName[];
  /** [icon, text] 元信息行,支持多行 */
  metaRows: [VenueMetaIcon, string][][];
  chips: string[];
  accent: "danger" | "success";
  /** 仅会议有倒计时 */
  deadline?: {
    label: string;
    dateText: string;
    /** 相对当前时间的毫秒偏移(演示用实时倒计时) */
    offsetMs: number;
  };
}

export type VenueMetaIcon = "folder" | "pin" | "cal" | "chart" | "quote";

export type VenueBadgeName =
  | "CCF A"
  | "CCF C"
  | "CORE A*"
  | "TH-CPL A"
  | "TH-CPL B"
  | "CSRanking"
  | "CAAI A"
  | "CAAI C"
  | "中科院1区"
  | "JCR Q1"
  | "高质量期刊 T1";

/** 学者 */
export interface Scholar {
  id: string;
  nameCn: string;
  nameEn: string;
  initials: string;
  avatarColor: string;
  role: string;
  affiliation: string;
  bio: string;
  citations: string;
  hIndex: number;
  tags: string[];
  followed?: boolean;
}

export interface Publication {
  id: string;
  title: string;
  abstract: string;
  authors: string;
  venue: string;
  citations: string;
  citationsShort: string;
}

/** 知识库文献 */
export interface LibraryItem {
  id: string;
  title: string;
  venue: string;
  arxiv: string;
  authors: string;
  addedAt: string;
  pdfTone: "violet" | "amber" | "green";
}

export interface LibraryFolder {
  name: string;
  count: number;
  active?: boolean;
}

/** AI 研究助手 */
export interface AgentReference {
  id: number;
  venue: string;
  title: string;
  author: string;
  citations: string;
  tone: "violet" | "green" | "amber" | "gray";
  recommended?: boolean;
}

export interface RecentResearch {
  id: string;
  title: string;
  time: string;
  refs: number;
  active?: boolean;
}

/** 论文详情(阅读器) */
export interface PaperDetail {
  id: string;
  title: string;
  authors: string[];
  affiliation: string;
  likes: number;
  page: { current: number; total: number };
  toc: { id: string; label: string; active?: boolean }[];
  abstract: string;
  introduction: string;
}

export interface SimilarPaper {
  title: string;
  meta: string;
}
