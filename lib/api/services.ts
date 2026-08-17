/**
 * 各域 API 查询 hooks —— 统一「真实接口 + mock 保底」策略：
 * API 可用时返回真实数据；请求失败（后端未启动等）自动回退到 lib/data 的 mock，
 * 并用 placeholderData 保证首屏不闪烁。
 */
"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet, apiPost, streamChat, type ChatStreamEvent } from "./client";
import {
  toFeedPaper,
  toGraph,
  toInstitution,
  toLibraryItem,
  toPaperDetail,
  toScholar,
  toVenue,
  type BackendGraph,
  type BackendInstitution,
  type BackendLibraryItem,
  type BackendPaper,
  type BackendScholar,
  type BackendScholarDetail,
  type BackendVenue,
} from "./adapters";
import { feedPapers } from "@/lib/data/papers";
import { venues } from "@/lib/data/venues";
import { libraryItems } from "@/lib/data/library";
import { scholars as mockScholars, scholarDetail as mockScholarDetail } from "@/lib/data/scholars";
import { institutions as mockInstitutions } from "@/lib/data/institutions";
import { getProject as mockGetProject, projects as mockProjects } from "@/lib/data/projects";
import { privateGraph as mockPrivateGraph, publicGraph as mockPublicGraph } from "@/lib/data/knowledge-graph";
import { paperDetail as mockPaperDetail } from "@/lib/data/paper-detail";
import type { Project } from "@/lib/data/projects";
import type { Scholar } from "@/types";

/** 主发现页 Feed 流 */
export function useFeedPapers() {
  return useQuery({
    queryKey: ["api", "papers", "feed"],
    queryFn: async () => {
      try {
        const json = await apiGet<{ data: BackendPaper[] }>(
          "/api/papers?page=1&page_size=50",
        );
        return json.data.map(toFeedPaper);
      } catch {
        return feedPapers;
      }
    },
    placeholderData: feedPapers,
    staleTime: 60_000,
  });
}

/** 投稿页会议/期刊列表 */
export function useVenues() {
  return useQuery({
    queryKey: ["api", "venues"],
    queryFn: async () => {
      try {
        const json = await apiGet<{ data: BackendVenue[] }>("/api/journals");
        return json.data.map(toVenue);
      } catch {
        return venues;
      }
    },
    placeholderData: venues,
    staleTime: 60_000,
  });
}

/** 投稿方向匹配（use_llm 开关） */
export async function matchVenues(
  title: string,
  abstract: string,
  keywords: string[],
  useLlm = false,
) {
  try {
    const json = await apiPost<{ data: BackendVenue[]; mode?: string }>(
      "/api/submission/match",
      { title, abstract, keywords, use_llm: useLlm },
    );
    return { data: json.data.map(toVenue), mode: json.mode ?? "keyword" };
  } catch {
    return null;
  }
}

/** 知识库文献列表 */
export function useLibraryItems() {
  return useQuery({
    queryKey: ["api", "library"],
    queryFn: async () => {
      try {
        const json = await apiGet<{ data: BackendLibraryItem[] }>("/api/library");
        return json.data.map(toLibraryItem);
      } catch {
        return libraryItems;
      }
    },
    placeholderData: libraryItems,
    staleTime: 60_000,
  });
}

/** 学者列表 */
export function useScholars() {
  return useQuery({
    queryKey: ["api", "scholars"],
    queryFn: async () => {
      try {
        const json = await apiGet<{ data: BackendScholar[] }>("/api/scholars");
        return json.data.map((s, i) => toScholar(s, i));
      } catch {
        return mockScholars;
      }
    },
    placeholderData: mockScholars,
    staleTime: 60_000,
  });
}

/** 学者详情（无真实详情时回退原型演示数据） */
export function useScholarDetail(id: string) {
  return useQuery({
    queryKey: ["api", "scholar", id],
    queryFn: async () => {
      try {
        const json = await apiGet<{ data: BackendScholarDetail | BackendScholar }>(
          `/api/scholars/${id}`,
        );
        const d = json.data as Partial<BackendScholarDetail>;
        if (d && Array.isArray(d.bio) && d.metrics) {
          return d as BackendScholarDetail;
        }
        return mockScholarDetail;
      } catch {
        return mockScholarDetail;
      }
    },
    placeholderData: mockScholarDetail,
    staleTime: 60_000,
  });
}

/** 机构列表 */
export function useInstitutions() {
  return useQuery({
    queryKey: ["api", "institutions"],
    queryFn: async () => {
      try {
        const json = await apiGet<{ data: BackendInstitution[] }>(
          "/api/institutions",
        );
        return json.data.map((i, index) => toInstitution(i, index));
      } catch {
        return mockInstitutions;
      }
    },
    placeholderData: mockInstitutions,
    staleTime: 60_000,
  });
}

/** 项目列表 */
export function useProjects() {
  return useQuery({
    queryKey: ["api", "projects"],
    queryFn: async () => {
      try {
        const json = await apiGet<{ data: Project[] }>("/api/projects");
        return json.data;
      } catch {
        return mockProjects;
      }
    },
    placeholderData: mockProjects,
    staleTime: 60_000,
  });
}

/** 项目详情 */
export function useProject(id: string) {
  return useQuery({
    queryKey: ["api", "project", id],
    queryFn: async () => {
      try {
        const json = await apiGet<{ data: Project }>(`/api/projects/${id}`);
        return json.data;
      } catch {
        return mockGetProject(id);
      }
    },
    placeholderData: mockGetProject(id),
    staleTime: 60_000,
  });
}

/** 论文详情（+ 全文回退 intro / 页码） */
export function usePaperDetail(id: string) {
  return useQuery({
    queryKey: ["api", "paper", id],
    queryFn: async () => {
      try {
        const json = await apiGet<{ data: BackendPaper }>(`/api/papers/${id}`);
        const fulltext = await apiGet<{
          data?: { chunks?: { page: number; text: string }[] };
        }>(`/api/papers/${id}/fulltext`).catch(() => null);
        return toPaperDetail(json.data, id, fulltext?.data ?? null);
      } catch {
        return { ...mockPaperDetail, id };
      }
    },
    placeholderData: { ...mockPaperDetail, id },
    staleTime: 60_000,
  });
}

/** 公域知识图谱（某论文的引用关系） */
export function usePublicGraph() {
  return useQuery({
    queryKey: ["api", "graph", "public"],
    queryFn: async () => {
      try {
        const json = await apiGet<{ data: BackendGraph }>(
          "/api/papers/rdt-1b/graph",
        );
        return toGraph(json.data);
      } catch {
        return mockPublicGraph;
      }
    },
    placeholderData: mockPublicGraph,
    staleTime: 60_000,
  });
}

/** 私域知识图谱（我的发表 × 收藏） */
export function usePrivateGraph() {
  return useQuery({
    queryKey: ["api", "graph", "private"],
    queryFn: async () => {
      try {
        const json = await apiGet<{ data: BackendGraph }>("/api/knowledge/graph");
        return toGraph(json.data);
      } catch {
        return mockPrivateGraph;
      }
    },
    placeholderData: mockPrivateGraph,
    staleTime: 60_000,
  });
}

/** 发送对话并流式接收（agent 对话 / 翻译共用后端 SSE 协议） */
export async function* sendChat(
  message: string,
  history: { role: "user" | "assistant"; content: string }[],
  signal?: AbortSignal,
): AsyncGenerator<ChatStreamEvent, void, unknown> {
  yield* streamChat(
    "/api/chat/stream",
    { message, messages: history },
    signal,
  );
}

/** 论文检索（/api/search，带 relevance） */
export async function searchPapers(query: string) {
  try {
    const json = await apiPost<{ data: BackendPaper[] }>("/api/search", {
      query,
    });
    return json.data.map(toFeedPaper);
  } catch {
    return feedPapers.filter((p) =>
      `${p.title} ${p.abstract}`.toLowerCase().includes(query.toLowerCase()),
    );
  }
}

/** 学者基础信息快捷查找（详情页头部用） */
export function findScholar(scholars: Scholar[], id: string): Scholar {
  return scholars.find((s) => s.id === id) ?? scholars[0];
}

/** 快速模式检索结果（/api/search 数据字段对齐） */
export interface QuickPaper {
  id: string;
  title: string;
  authors: string;
  venue: string;
  ccf: string;
  year: number | null;
  citations: number;
  abstract: string;
  relevance: number | null;
  match: string;
}

/**
 * 快速检索（AI 助手「快速」模式 / 发现页）：只调 scout 数据层做本地直检
 * （三路 RRF 融合 + 可选交叉编码器精排），后端额外返回基于检索结果的
 * 「简易回答」（一次轻量 LLM，失败回退模板）。后端不可达时回退本地 mock。
 */
export async function quickSearchPapers(
  query: string,
): Promise<{ papers: QuickPaper[]; summary: string }> {
  try {
    const json = await apiPost<{ data: Array<Record<string, unknown>>; summary?: unknown }>(
      "/api/search",
      { query },
    );
    const papers = (json.data ?? []).map((p) => ({
      id: String(p.id ?? ""),
      title: String(p.title ?? "Untitled"),
      authors:
        Array.isArray(p.author_list) && (p.author_list as unknown[]).length
          ? (p.author_list as unknown[]).join(", ")
          : String(p.authors ?? ""),
      venue: String(p.venue ?? "arXiv"),
      ccf: p.ccf ? String(p.ccf) : "",
      year: p.year ? Number(p.year) : null,
      citations: Number(p.citations ?? 0),
      abstract: String(p.abstract ?? ""),
      relevance: typeof p.relevance === "number" ? (p.relevance as number) : null,
      match: String(p.matchLabel ?? p.match ?? ""),
    }));
    return { papers, summary: typeof json.summary === "string" ? json.summary : "" };
  } catch {
    const fallback = await searchPapers(query);
    return {
      papers: fallback.map((p) => ({
        id: p.id,
        title: p.title,
        authors: p.authors,
        venue: p.venue,
        ccf: "",
        year: null,
        citations: p.citations,
        abstract: p.abstract,
        relevance: null,
        match: "",
      })),
      summary: "",
    };
  }
}

/**
 * 快速模式的回答文本：优先使用后端的「简易回答」summary（直接回应用户问题），
 * 之后附上检索到的论文清单（供精读/跳转）。
 */
export function formatQuickAnswer(
  query: string,
  papers: QuickPaper[],
  summary?: string,
): string {
  const list = formatPaperList(query, papers);
  const head = (summary ?? "").trim();
  if (head) return `${head}\n\n---\n\n${list}`;
  return list;
}

/** 简易回答模板（后端 summary 不可用时的兜底头部 + 论文清单） */
export function formatPaperList(query: string, papers: QuickPaper[]): string {
  if (papers.length === 0) {
    return `针对「${query}」，未检索到相关论文。建议更换关键词后重试。`;
  }
  const lines = [
    `针对「${query}」，为你检索到 **${papers.length} 篇**候选论文（快速检索，按相关度排序）：`,
    "",
  ];
  papers.forEach((p, index) => {
    const meta = [
      p.venue,
      p.year ? String(p.year) : "",
      p.ccf ? `CCF ${p.ccf}` : "",
      `引用 ${p.citations}`,
      p.relevance != null ? `相关度 ${Math.round(p.relevance * 100)}` : "",
    ]
      .filter(Boolean)
      .join(" · ");
    lines.push(`${index + 1}. **${p.title}**（${p.authors || "未知作者"}）`);
    if (meta) lines.push(`   - ${meta}`);
    if (p.abstract) {
      const abstract =
        p.abstract.length > 140 ? p.abstract.slice(0, 140).trimEnd() + "…" : p.abstract;
      lines.push(`   - 摘要：${abstract}`);
    }
  });
  return lines.join("\n");
}
