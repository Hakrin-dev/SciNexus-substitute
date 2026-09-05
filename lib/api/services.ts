/**
 * 各域 API 查询 hooks —— 统一「真实接口 + mock 保底」策略：
 * API 可用时返回真实数据；请求失败（后端未启动等）自动回退到 lib/data 的 mock，
 * 并用 placeholderData 保证首屏不闪烁。
 *
 * 回退是**显式**的：mock 数据经 tagMock 打上符号标记，全局 <MockDataBadge>
 * 据此提示「演示数据」；开发环境同时在 console.warn 记录降级原因。
 *
 * 后端为 Next.js Route Handlers（同源 /api/*），返回统一 { success, data, ... } 结构；
 * 新版后端已在服务端完成视觉字段派生（venueTone / initials / avatarColor 等），
 * 故此处直接消费 data，仅对阅读器详情做归一化。
 */
"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPatch, apiPost, apiPut, streamChat, type ChatStreamEvent } from "./client";
import {
  normalizeVenues,
  toFeedPaper,
  toPaperDetail,
  toVenue,
  type BackendPaper,
  type BackendMatchedVenue,
  type BackendScholarDetail,
  type BackendVenue,
} from "./adapters";
import { toast } from "@/stores/toast";
import { feedPapers } from "@/lib/data/papers";
import { venues } from "@/lib/data/venues";
import { libraryItems } from "@/lib/data/library";
import { scholars as mockScholars, scholarDetail as mockScholarDetail } from "@/lib/data/scholars";
import { institutions as mockInstitutions } from "@/lib/data/institutions";
import { getProject as mockGetProject, projects as mockProjects } from "@/lib/data/projects";
import { useDemoState } from "@/stores/demo-state";
import {
  workbenchActivity as wbActivity,
  workbenchAgentTasks as wbAgentTasks,
  workbenchAssets as wbAssets,
  workbenchCards as wbCards,
  workbenchOutline as wbOutline,
  workbenchOverview as wbOverview,
  workbenchThreads as wbThreads,
} from "@/lib/data/workbench";
import type {
  ActivityEntry,
  AgentTask,
  OutlineNode,
  ResearchThread,
  ThreadCard,
  WorkbenchAsset,
  WorkbenchOverview,
} from "@/lib/data/workbench";
import { privateGraph as mockPrivateGraph, publicGraph as mockPublicGraph } from "@/lib/data/knowledge-graph";
import { paperDetail as mockPaperDetail } from "@/lib/data/paper-detail";
import type { Project } from "@/lib/data/projects";
import type { FeedPaper, LibraryItem, MatchedVenue, PaperGraph, Scholar, Venue } from "@/types";

/* ── mock 兜底显式化 ─────────────────────────────────────────── */

/** mock 回退数据的符号标记(不参与 JSON/渲染,仅供 <MockDataBadge> 检测) */
export const MOCK_TAG = Symbol("scinexus.mock");
/** 回退数据所属域，供 UI 说明是哪一部分在用演示数据。 */
export const MOCK_DOMAIN = Symbol("scinexus.mock-domain");

/** 给回退数据打上演示标记 */
export function tagMock<T>(data: T, domain = "数据"): T {
  try {
    if (data && typeof data === "object") {
      (data as Record<symbol, unknown>)[MOCK_TAG] = true;
      (data as Record<symbol, unknown>)[MOCK_DOMAIN] = domain;
    }
  } catch {
    // 不可扩展对象忽略标记
  }
  return data;
}

/** 统一降级入口:开发环境告警 + 打标记后返回 mock */
function mockFallback<T>(source: string, err: unknown, fallback: T): T {
  if (process.env.NODE_ENV !== "production") {
    console.warn(`[scinexus] ${source} 请求失败，已回退演示数据:`, err);
  }
  const domain = source.includes("conversations") ? "对话" : source.includes("projects")
    ? "项目" : source.includes("search") || source.includes("papers") || source.includes("graph")
      ? "论文/图谱" : "其他数据";
  return tagMock(fallback, domain);
}

/** 主发现页 Feed 流 */
export function useFeedPapers() {
  return useQuery({
    queryKey: ["api", "papers", "feed"],
    queryFn: async () => {
      try {
        const json = await apiGet<FeedPaper[]>("/api/papers", { page: 1, page_size: 50 });
        return json.data ?? [];
      } catch (err) {
        return mockFallback("/api/papers", err, feedPapers);
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
        const json = await apiGet<BackendVenue[]>("/api/venues");
        return normalizeVenues(json.data ?? []);
      } catch (err) {
        return mockFallback("/api/venues", err, venues);
      }
    },
    placeholderData: venues,
    staleTime: 60_000,
  });
}

/** 投稿方向匹配 */
/**
 * 投稿方向匹配:标题/摘要/关键词 → Top5 会议/期刊推荐。
 * useLlm 为真时后端走 LLM 语义匹配(未配置或失败自动回退关键词),
 * 实际使用的模式以返回的 mode 为准。失败抛出,由调用方呈现错误。
 */
export async function matchVenues(
  title: string,
  abstract: string,
  keywords: string[],
  useLlm = true,
): Promise<{ data: MatchedVenue[]; mode: "llm" | "keyword" }> {
  const json = await apiPost<BackendMatchedVenue[]>("/api/submission/match", {
    title,
    abstract,
    keywords,
    use_llm: useLlm,
  });
  return {
    data: (json.data ?? []).map((venue): MatchedVenue => ({
      ...toVenue(venue),
      matchPct: venue.matchPct ?? 0,
      matchClass:
        venue.matchClass === "high" || venue.matchClass === "mid" || venue.matchClass === "low"
          ? venue.matchClass
          : "low",
      matchReason: venue.matchReason ?? "",
    })),
    mode: json.mode === "llm" ? "llm" : "keyword",
  };
}

/** 知识库文献列表 */
export function useLibraryItems() {
  return useQuery({
    queryKey: ["api", "library"],
    queryFn: async () => {
      try {
        const json = await apiGet<LibraryItem[]>("/api/library");
        return json.data ?? [];
      } catch (err) {
        return mockFallback("/api/library", err, libraryItems);
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
        const json = await apiGet<Scholar[]>("/api/scholars");
        return json.data ?? [];
      } catch (err) {
        return mockFallback("/api/scholars", err, mockScholars);
      }
    },
    placeholderData: mockScholars,
    staleTime: 60_000,
  });
}

/** 学者研究方向图谱（后端按共享方向构图；后端不可达时本地按相同规则兜底） */
export interface ScholarGraphData {
  nodes: Scholar[];
  edges: { source: string; target: string; label: string; strength: number }[];
  directions: string[];
}

function buildScholarGraphLocal(scholars: Scholar[]): ScholarGraphData {
  const edges: ScholarGraphData["edges"] = [];
  for (let i = 0; i < scholars.length; i++) {
    for (let j = i + 1; j < scholars.length; j++) {
      const shared = scholars[i].tags.filter((tag) => scholars[j].tags.includes(tag));
      if (shared.length === 0) continue;
      edges.push({ source: scholars[i].id, target: scholars[j].id, label: shared.join("、"), strength: shared.length });
    }
  }
  const directions = Array.from(new Set(scholars.flatMap((s) => s.tags)));
  return { nodes: scholars, edges, directions };
}

export function useScholarGraph() {
  return useQuery({
    queryKey: ["api", "scholars", "graph"],
    queryFn: async () => {
      try {
        const json = await apiGet<ScholarGraphData>("/api/scholars/graph");
        if (json.data?.nodes?.length) return json.data;
        throw new Error("empty");
      } catch {
        return buildScholarGraphLocal(mockScholars);
      }
    },
    placeholderData: buildScholarGraphLocal(mockScholars),
    staleTime: 60_000,
  });
}

/** 学者详情（无真实详情时回退原型演示数据） */
export function useScholarDetail(id: string) {
  return useQuery<BackendScholarDetail>({
    queryKey: ["api", "scholar", id],
    queryFn: async () => {
      try {
        const json = await apiGet<any>(`/api/scholars/${id}`);
        const d = json.data;
        if (d && Array.isArray(d.bio) && d.metrics) {
          return d;
        }
        // 后端缺详情(如未收录学者),回退演示数据
        return mockFallback(`/api/scholars/${id}`, "missing detail shape", mockScholarDetail);
      } catch (err) {
        return mockFallback(`/api/scholars/${id}`, err, mockScholarDetail);
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
        const json = await apiGet<any[]>("/api/institutions");
        return json.data ?? [];
      } catch (err) {
        return mockFallback("/api/institutions", err, mockInstitutions);
      }
    },
    placeholderData: mockInstitutions,
    staleTime: 60_000,
  });
}

/** 项目列表 */
export function useProjects() {
  const demoProjects = useDemoState((s) => s.demoProjects);
  const query = useQuery({
    queryKey: ["api", "projects"],
    queryFn: async () => {
      try {
        const json = await apiGet<Project[]>("/api/projects");
        return json.data ?? [];
      } catch (err) {
        return mockFallback("/api/projects", err, mockProjects);
      }
    },
    placeholderData: mockProjects,
    staleTime: 60_000,
  });

  /** 合并前端演示态新建的项目(去重) */
  const data = React.useMemo(() => {
    const base = (query.data ?? []) as Project[];
    const extra = demoProjects.filter((d) => !base.some((b) => b.id === d.id));
    return [...extra, ...base];
  }, [query.data, demoProjects]);

  return { ...query, data };
}

/** 项目详情 */
export function useProject(id: string) {
  return useQuery({
    queryKey: ["api", "project", id],
    queryFn: async () => {
      try {
        const json = await apiGet<Project>(`/api/projects/${id}`);
        return json.data;
      } catch (err) {
        return mockFallback(`/api/projects/${id}`, err, mockGetProject(id));
      }
    },
    placeholderData: mockGetProject(id),
    staleTime: 60_000,
  });
}

/* ── 课题工作台(读端点已上线;写端点见各 mutation hook)────────────── */

/** 研究大纲树 */
export function useProjectOutline(id: string) {
  return useQuery({
    queryKey: ["api", "project", id, "outline"],
    queryFn: async () => {
      try {
        const json = await apiGet<OutlineNode[]>(`/api/projects/${id}/outline`);
        return json.data ?? wbOutline;
      } catch (err) {
        return mockFallback(`/api/projects/${id}/outline`, err, wbOutline);
      }
    },
    placeholderData: wbOutline,
    staleTime: 60_000,
  });
}

/** 研究线程列表 */
export function useProjectThreads(id: string) {
  return useQuery({
    queryKey: ["api", "project", id, "threads"],
    queryFn: async () => {
      try {
        const json = await apiGet<ResearchThread[]>(`/api/projects/${id}/threads`);
        return json.data ?? wbThreads;
      } catch (err) {
        return mockFallback(`/api/projects/${id}/threads`, err, wbThreads);
      }
    },
    placeholderData: wbThreads,
    staleTime: 60_000,
  });
}

/** 全部线程卡片(按线程过滤由组件完成) */
export function useThreadCards(id: string) {
  return useQuery({
    queryKey: ["api", "project", id, "thread-cards"],
    queryFn: async () => {
      try {
        const json = await apiGet<ThreadCard[]>(`/api/projects/${id}/thread-cards`);
        return json.data ?? wbCards;
      } catch (err) {
        return mockFallback(`/api/projects/${id}/thread-cards`, err, wbCards);
      }
    },
    placeholderData: wbCards,
    staleTime: 60_000,
  });
}

/** 工作台资产 */
export function useWorkbenchAssets(id: string) {
  return useQuery({
    queryKey: ["api", "project", id, "assets"],
    queryFn: async () => {
      try {
        const json = await apiGet<WorkbenchAsset[]>(`/api/projects/${id}/assets`);
        return json.data ?? wbAssets;
      } catch (err) {
        return mockFallback(`/api/projects/${id}/assets`, err, wbAssets);
      }
    },
    placeholderData: wbAssets,
    staleTime: 60_000,
  });
}

/** 活动日志 */
export function useWorkbenchActivity(id: string) {
  return useQuery({
    queryKey: ["api", "project", id, "activity"],
    queryFn: async () => {
      try {
        const json = await apiGet<ActivityEntry[]>(`/api/projects/${id}/activity`);
        return json.data ?? wbActivity;
      } catch (err) {
        return mockFallback(`/api/projects/${id}/activity`, err, wbActivity);
      }
    },
    placeholderData: wbActivity,
    staleTime: 60_000,
  });
}

/** 概览聚合 */
export function useWorkbenchOverview(id: string) {
  return useQuery({
    queryKey: ["api", "project", id, "overview"],
    queryFn: async () => {
      try {
        const json = await apiGet<WorkbenchOverview>(`/api/projects/${id}/overview`);
        return json.data ?? wbOverview;
      } catch (err) {
        return mockFallback(`/api/projects/${id}/overview`, err, wbOverview);
      }
    },
    placeholderData: wbOverview,
    staleTime: 60_000,
  });
}

/** Agent 任务状态(底部状态栏) */
export function useAgentTasks(id: string) {
  return useQuery({
    queryKey: ["api", "project", id, "agent-tasks"],
    queryFn: async () => {
      try {
        const json = await apiGet<AgentTask[]>(`/api/projects/${id}/tasks`);
        return json.data ?? wbAgentTasks;
      } catch (err) {
        return mockFallback(`/api/projects/${id}/tasks`, err, wbAgentTasks);
      }
    },
    placeholderData: wbAgentTasks,
    staleTime: 30_000,
  });
}

/**
 * 线程卡片状态流转(todo→doing→done)—— 工作台本期唯一的写路径。
 * 乐观更新本地缓存;成功后刷新活动日志(后端会写入一条日志)。
 */
export function useUpdateThreadCardStatus(projectId: string) {
  const queryClient = useQueryClient();
  const cardsKey = ["api", "project", projectId, "thread-cards"];
  return useMutation({
    mutationFn: async ({
      cardId,
      status,
    }: {
      cardId: string;
      status: ThreadCard["status"];
    }) => {
      await apiPatch(`/api/projects/${projectId}/thread-cards/${cardId}`, { status });
      return { cardId, status };
    },
    onMutate: async ({ cardId, status }) => {
      await queryClient.cancelQueries({ queryKey: cardsKey });
      const prev = queryClient.getQueryData<ThreadCard[]>(cardsKey);
      queryClient.setQueryData<ThreadCard[]>(cardsKey, (old) =>
        old?.map((c) => (c.id === cardId ? { ...c, status } : c)),
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(cardsKey, ctx.prev);
      toast.error("状态更新失败，请稍后重试");
    },
    onSuccess: () => {
      toast.success("已更新卡片状态");
      void queryClient.invalidateQueries({
        queryKey: ["api", "project", projectId, "activity"],
      });
    },
  });
}

/** 论文详情（+ 全文回退 intro / 页码） */
export function usePaperDetail(id: string) {
  return useQuery({
    queryKey: ["api", "paper", id],
    queryFn: async () => {
      try {
        // 详情与全文并行拉取(此前串行,TTFB 翻倍)
        const [json, fulltext] = await Promise.all([
          apiGet<any>(`/api/papers/${id}`),
          apiGet<{ chunks?: { page: number; text: string }[] }>(
            `/api/papers/${id}/fulltext`,
          ).catch(() => null),
        ]);
        return toPaperDetail(json.data, id, fulltext?.data ?? null);
      } catch (err) {
        return mockFallback(`/api/papers/${id}`, err, { ...mockPaperDetail, id });
      }
    },
    placeholderData: { ...mockPaperDetail, id },
    staleTime: 60_000,
  });
}

/** 公域知识图谱（某论文的引用关系;传 paperId 时以该论文为中心构图） */
export function usePublicGraph(paperId?: string) {
  return useQuery({
    queryKey: ["api", "graph", "public", paperId ?? "default"],
    queryFn: async () => {
      try {
        const json = await apiGet<PaperGraph>(
          "/api/graph/public",
          paperId ? { paper_id: paperId } : undefined,
        );
        return json.data;
      } catch (err) {
        // 指定论文的图谱失败时必须让页面呈现真实错误，不能展示无关演示图谱。
        if (paperId) throw err;
        return mockFallback("/api/graph/public", err, mockPublicGraph);
      }
    },
    placeholderData: paperId ? undefined : mockPublicGraph,
    staleTime: 60_000,
  });
}

/** 私域知识图谱（我的发表 × 收藏） */
export function usePrivateGraph() {
  return useQuery({
    queryKey: ["api", "graph", "private"],
    queryFn: async () => {
      try {
        const json = await apiGet<PaperGraph>("/api/graph/private");
        return json.data;
      } catch (err) {
        return mockFallback("/api/graph/private", err, mockPrivateGraph);
      }
    },
    placeholderData: mockPrivateGraph,
    staleTime: 60_000,
  });
}

/** 发送对话并流式接收 */
export async function* sendChat(
  message: string,
  history: { role: "user" | "assistant"; content: string }[],
  signal?: AbortSignal,
  model?: string,
  conversationId?: string,
  context?: Record<string, unknown>,
  mode?: "fast" | "deep",
  webSearch?: boolean,
): AsyncGenerator<ChatStreamEvent, void, unknown> {
  yield* streamChat(
    "/api/chat/stream",
    {
      message,
      messages: history,
      model,
      mode,
      conversation_id: conversationId,
      context,
      web_search: webSearch || undefined,
    },
    signal,
  );
}

/* ── 对话历史(真实接口) ──────────────────────────────────────── */

export interface ConversationSummary {
  id: string;
  title: string;
  preview: string;
  updatedAt: string;
}

/** 对话历史列表(需登录;未登录/失败返回空列表,由 UI 呈现登录引导) */
export function useConversations() {
  return useQuery({
    queryKey: ["api", "conversations"],
    queryFn: async () => {
      try {
        const json = await apiGet<ConversationSummary[]>("/api/conversations");
        return json.data ?? [];
      } catch (err) {
        return mockFallback("/api/conversations", err, [] as ConversationSummary[]);
      }
    },
    staleTime: 15_000,
  });
}

/** 历史消息(含深度轮的结构化数据,用于回放报告块) */
export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  workflow?: unknown;
  references?: unknown;
}

/** 拉取单个会话的消息列表(用于点击历史对话回填画布) */
export async function fetchConversationMessages(id: string): Promise<ConversationMessage[]> {
  const json = await apiGet<{
    messages?: {
      role: string;
      content: string;
      workflow?: unknown;
      references?: unknown;
    }[];
  }>(`/api/conversations/${id}`);
  return (json.data?.messages ?? []).map((m) => ({
    role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
    content: m.content,
    workflow: m.workflow ?? undefined,
    references: m.references ?? undefined,
  }));
}

/* ── AI 长期记忆(真实接口 + 演示态保底)────────────────────────── */

/** 记忆条目(登录后为后端数据;未登录回退 demo-state 派生) */
export interface MemoryItem {
  id: string;
  /** 记忆的事实陈述(AI 视角第一人称) */
  fact: string;
  /** 来源,如「对话-2026-08-31」/「手动」 */
  source: string;
  createdAt: string;
  scope: "global" | "project";
  /** scope=project 时的项目名(展示用) */
  project?: string;
  /** 单条启用状态(演示态由 memoryOff 派生) */
  enabled: boolean;
}

export interface MemoryData {
  /** 记忆总开关:关闭后 agent 不再引用记忆 */
  enabled: boolean;
  items: MemoryItem[];
}

/**
 * AI 记忆读取:登录后走 GET /api/memory(SQLite 持久化,重启不丢);
 * 未登录/后端不可达时回退 demo-state(浏览器本地持久化,实时派生)。
 * 返回 source 供调用方区分真实/演示数据。
 */
export function useMemory(): { data: MemoryData; source: "api" | "demo" } {
  const demoEntries = useDemoState((s) => s.memoryEntries);
  const demoEnabled = useDemoState((s) => s.memoryEnabled);
  const demoOff = useDemoState((s) => s.memoryOff);

  const demoData = React.useMemo<MemoryData>(
    () => ({
      enabled: demoEnabled,
      items: demoEntries.map((e) => ({ ...e, enabled: !demoOff[e.id] })),
    }),
    [demoEntries, demoEnabled, demoOff],
  );

  const query = useQuery({
    queryKey: ["api", "memory"],
    queryFn: async (): Promise<MemoryData> => {
      const json = await apiGet<{ enabled?: boolean; items?: any[] }>("/api/memory");
      const items = json.data?.items;
      if (!Array.isArray(items)) throw new Error("missing memory shape");
      return {
        enabled: json.data?.enabled ?? true,
        items: items.map(
          (it): MemoryItem => ({
            id: String(it.id ?? ""),
            fact: String(it.fact ?? ""),
            source: String(it.source ?? "手动"),
            createdAt: String(it.createdAt ?? ""),
            scope: it.scope === "project" ? "project" : "global",
            project: typeof it.project === "string" && it.project ? it.project : undefined,
            enabled: it.enabled !== false,
          }),
        ),
      };
    },
    placeholderData: demoData,
    staleTime: 15_000,
    retry: 0,
  });

  if (query.data) return { data: query.data, source: "api" };
  return { data: demoData, source: "demo" };
}

const MEMORY_KEY = ["api", "memory"] as const;

/** 记忆总开关;未登录/离线时回退 demo-state */
export function useSetMemoryEnabled() {
  const queryClient = useQueryClient();
  const setMemoryEnabled = useDemoState((s) => s.setMemoryEnabled);
  return useMutation({
    mutationFn: async (enabled: boolean) => {
      await apiPut("/api/memory", { enabled });
      return enabled;
    },
    onMutate: async (enabled) => {
      await queryClient.cancelQueries({ queryKey: MEMORY_KEY });
      const prev = queryClient.getQueryData<MemoryData>(MEMORY_KEY);
      if (prev) queryClient.setQueryData<MemoryData>(MEMORY_KEY, { ...prev, enabled });
      return { prev };
    },
    onError: (_err, enabled, ctx) => {
      if (ctx?.prev) queryClient.setQueryData<MemoryData>(MEMORY_KEY, ctx.prev);
      else setMemoryEnabled(enabled); // 未登录/离线 → 本地演示态
    },
    onSuccess: (enabled) => {
      queryClient.setQueryData<MemoryData>(MEMORY_KEY, (old) =>
        old ? { ...old, enabled } : old,
      );
    },
  });
}

/** 启用/停用单条记忆;未登录/离线时回退 demo-state */
export function useToggleMemoryEntry() {
  const queryClient = useQueryClient();
  const toggleMemoryEntry = useDemoState((s) => s.toggleMemoryEntry);
  return useMutation({
    mutationFn: async (id: string) => {
      await apiPost(`/api/memory/entries/${id}/toggle`);
      return id;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: MEMORY_KEY });
      const prev = queryClient.getQueryData<MemoryData>(MEMORY_KEY);
      if (prev) {
        queryClient.setQueryData<MemoryData>(MEMORY_KEY, (old) =>
          old
            ? {
                ...old,
                items: old.items.map((it) =>
                  it.id === id ? { ...it, enabled: !it.enabled } : it,
                ),
              }
            : old,
        );
      }
      return { prev };
    },
    onError: (_err, id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData<MemoryData>(MEMORY_KEY, ctx.prev);
      else toggleMemoryEntry(id); // 未登录/离线 → 本地演示态
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: MEMORY_KEY });
    },
  });
}

/** 删除单条记忆;未登录/离线时回退 demo-state */
export function useDeleteMemoryEntry() {
  const queryClient = useQueryClient();
  const deleteMemoryEntry = useDemoState((s) => s.deleteMemoryEntry);
  return useMutation({
    mutationFn: async (id: string) => {
      await apiDelete(`/api/memory/entries/${id}`);
      return id;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: MEMORY_KEY });
      const prev = queryClient.getQueryData<MemoryData>(MEMORY_KEY);
      if (prev) {
        queryClient.setQueryData<MemoryData>(MEMORY_KEY, (old) =>
          old ? { ...old, items: old.items.filter((it) => it.id !== id) } : old,
        );
      }
      return { prev };
    },
    onError: (_err, id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData<MemoryData>(MEMORY_KEY, ctx.prev);
      else deleteMemoryEntry(id); // 未登录/离线 → 本地演示态
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: MEMORY_KEY });
    },
  });
}
/** 论文检索（/api/search，带 relevance） */
export interface KnowledgeSearchFilters {
  yearFrom?: number;
  yearTo?: number;
  conferences?: string[];
  authors?: string[];
  keywords?: string[];
  subjects?: string[];
  topK?: number;
}

/** 浏览器可见的知识底座状态；失败不回退 mock，避免把远程状态误报为连接成功。 */
export function useKnowledgeHealth() {
  return useQuery({
    queryKey: ["api", "knowledge", "health"],
    queryFn: () => apiGet<{
      status: "ready" | "degraded" | "unavailable";
      provider: string;
      checkedAt: string;
      tookMs: number;
      checks: Record<string, { ok: boolean; data?: unknown; error?: string }>;
    }>("/api/knowledge/health").then((response) => response.data),
    staleTime: 30_000,
    retry: 0,
  });
}

/** 论文检索（/api/search，保留远程来源、排序和回退状态）。 */
export async function searchPapers(query: string, filters: KnowledgeSearchFilters = {}) {
  try {
    const json = await apiPost<BackendPaper[]>("/api/search", {
      query,
      year_from: filters.yearFrom,
      year_to: filters.yearTo,
      conference: filters.conferences,
      author: filters.authors,
      keyword: filters.keywords,
      subject: filters.subjects,
      top_k: filters.topK,
    });
    const fallbackUsed = json.meta?.fallbackUsed === true;
    const source = typeof json.meta?.source === "string" ? json.meta.source : undefined;
    return (json.data ?? []).map((paper) =>
      toFeedPaper({ ...paper, source: paper.source ?? source, fallbackUsed }),
    );
  } catch (err) {
    return mockFallback(
      "/api/search",
      err,
      feedPapers.filter((p) =>
        `${p.title} ${p.abstract}`.toLowerCase().includes(query.toLowerCase()),
      ),
    );
  }
}

/** 学者基础信息快捷查找（详情页头部用）；未命中返回 undefined,由页面渲染 404 */
export function findScholar(scholars: Scholar[], id: string): Scholar | undefined {
  return scholars.find((s) => s.id === id);
}

/** 快速模式检索结果 */
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
  source?: string;
  rank?: number | null;
  knowledgeScore?: number | null;
  keywords?: string[];
  subjects?: string[];
  url?: string | null;
}

/**
 * 快速检索：调后端本地索引，返回论文清单 + 后端生成的「简易回答」summary。
 * 后端不可达时回退本地 mock。
 */
export async function quickSearchPapers(
  query: string,
  conversationId?: string,
  webSearch?: boolean,
): Promise<{ papers: QuickPaper[]; summary: string; conversationId?: string }> {
  try {
    const json = await apiPost<Array<Record<string, unknown>>>(
      "/api/search",
      { query, conversation_id: conversationId, web_search: webSearch || undefined },
    );
    const response = json as typeof json & { conversation_id?: unknown };
    const papers = (json.data ?? []).map((p) => ({
      id: String(p.id ?? ""),
      title: String(p.title ?? "Untitled"),
      authors: String(p.authors ?? ""),
      venue: String(p.venue ?? "arXiv"),
      ccf: p.ccf ? String(p.ccf) : "",
      year: p.year ? Number(p.year) : null,
      citations: Number(p.citations ?? 0),
      abstract: String(p.abstract ?? ""),
      relevance: typeof p.relevance === "number" ? (p.relevance as number) : null,
      match: String(p.matchLabel ?? p.match ?? ""),
      source: p.source ? String(p.source) : undefined,
      rank: p.rank != null ? Number(p.rank) : null,
      knowledgeScore: p.knowledgeScore != null ? Number(p.knowledgeScore) : null,
      keywords: Array.isArray(p.keywords) ? p.keywords.map(String) : [],
      subjects: Array.isArray(p.subjects) ? p.subjects.map(String) : [],
      url: typeof p.url === "string" && p.url ? p.url : null,
    }));
    return {
      papers,
      summary: typeof json.summary === "string" ? json.summary : "",
      conversationId: typeof response.conversation_id === "string"
        ? response.conversation_id
        : typeof json.meta?.conversation_id === "string" ? json.meta.conversation_id : undefined,
    };
  } catch (err) {
    const fallback = await searchPapers(query);
    if (process.env.NODE_ENV !== "production") {
      console.warn("[scinexus] /api/search 快速检索失败，已回退演示数据:", err);
    }
    tagMock(fallback);
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
      p.source === "remote_knowledge_base"
        ? `远程知识底座${p.rank ? ` · 排名 #${p.rank}` : ""}`
        : p.relevance != null
          ? `相关度 ${Math.round(p.relevance * 100)}`
          : "",
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
