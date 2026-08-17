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
