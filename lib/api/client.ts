/**
 * 研枢前端 API 调用客户端
 * 统一封装所有后端接口调用，自动附加 token，统一处理响应结构
 *
 * 使用：
 *   import api from '@/lib/api/client';
 *   const { data } = await api.papers.list({ page: 1 });
 */

// 后端基础地址:默认同源(空字符串 → 相对路径 /api/*,命中 Next.js 自带 Route Handlers);
// 可通过 NEXT_PUBLIC_API_URL 或运行时 window.__API_BASE__ 覆盖为外部 FastAPI 服务
export const API_BASE =
  (typeof window !== "undefined"
    ? window.__API_BASE__ || process.env.NEXT_PUBLIC_API_URL
    : process.env.NEXT_PUBLIC_API_URL) || "";

// 存储 token 的 key（与 stores/auth.ts 保持一致，可替换为 Cookie/HttpOnly）
const TOKEN_KEY = "yanshu_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export interface ApiResp<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  summary?: string;
  pagination?: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
  stats?: any;
  meta?: any;
}

class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status = 400, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T = any>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  url: string,
  options?: {
    query?: Record<string, any>;
    body?: any;
    headers?: Record<string, string>;
    skipAuth?: boolean;
  }
): Promise<ApiResp<T>> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(options?.headers || {}),
  };
  if (options?.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  const token = getToken();
  if (!options?.skipAuth && token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let fullUrl = API_BASE + url;
  if (options?.query) {
    const usp = new URLSearchParams();
    for (const k of Object.keys(options.query)) {
      const v = options.query[k];
      if (v !== undefined && v !== null) usp.append(k, String(v));
    }
    const qs = usp.toString();
    if (qs) fullUrl += (fullUrl.includes("?") ? "&" : "?") + qs;
  }

  const resp = await fetch(fullUrl, {
    method,
    headers,
    body: options?.body
      ? options.body instanceof FormData
        ? options.body
        : JSON.stringify(options.body)
      : undefined,
  });

  let parsed: any = null;
  const text = await resp.text();
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }

  if (!resp.ok) {
    const msg = parsed?.error || `HTTP ${resp.status} ${resp.statusText}`;
    throw new ApiError(msg, resp.status, parsed?.code);
  }

  return (parsed || { success: true }) as ApiResp<T>;
}

export const client = {
  // ---------- 健康 ----------
  health: () => request<any>("GET", "/api/health", { skipAuth: true }),

  // ---------- 认证 ----------
  auth: {
    login: (username: string, password: string) =>
      request<{ token: string; user: any }>("POST", "/api/auth/login", {
        body: { username, password },
        skipAuth: true,
      }),
    register: (params: {
      username: string;
      password: string;
      email?: string;
      displayName?: string;
    }) =>
      request<{ token: string; user: any }>("POST", "/api/auth/register", {
        body: params,
        skipAuth: true,
      }),
    me: () => request<any>("GET", "/api/auth/me"),
  },

  // ---------- 论文 ----------
  papers: {
    list: (query?: {
      page?: number;
      page_size?: number;
      sort_by?: string;
      ccf?: string;
      year?: number;
      keyword?: string;
    }) => request<any>("GET", "/api/papers", { query }),
    recommended: (limit = 9) =>
      request<any>("GET", "/api/papers/recommended", { query: { limit } }),
    detail: (id: string) => request<any>("GET", `/api/papers/${id}`),
  },

  // ---------- 学者 ----------
  scholars: {
    list: (query?: {
      page?: number;
      page_size?: number;
      keyword?: string;
      sort_by?: string;
      direction?: string;
    }) => request<any>("GET", "/api/scholars", { query }),
    detail: (id: string) => request<any>("GET", `/api/scholars/${id}`),
    follow: (id: string) => request<any>("POST", `/api/scholars/${id}/follow`),
    unfollow: (id: string) => request<any>("DELETE", `/api/scholars/${id}/follow`),
  },

  // ---------- 机构 ----------
  institutions: {
    list: (query?: {
      page?: number;
      page_size?: number;
      keyword?: string;
      type?: string;
      sort_by?: string;
    }) => request<any>("GET", "/api/institutions", { query }),
    bookmark: (id: string) =>
      request<any>("POST", `/api/institutions/${id}/bookmark`),
    unbookmark: (id: string) =>
      request<any>("DELETE", `/api/institutions/${id}/bookmark`),
  },

  // ---------- 知识图谱 ----------
  graph: {
    publicGraph: () => request<any>("GET", "/api/graph/public"),
    privateGraph: () => request<any>("GET", "/api/graph/private"),
  },

  // ---------- 项目 ----------
  projects: {
    list: (query?: { page?: number; page_size?: number; status?: string }) =>
      request<any>("GET", "/api/projects", { query }),
    create: (body: any) => request<any>("POST", "/api/projects", { body }),
    detail: (id: string) => request<any>("GET", `/api/projects/${id}`),
    update: (id: string, body: any) =>
      request<any>("PUT", `/api/projects/${id}`, { body }),
    remove: (id: string) => request<any>("DELETE", `/api/projects/${id}`),
  },

  // ---------- 搜索 + 对话 ----------
  search: (body: {
    query: string;
    mode?: string;
    ccf?: string;
    year_from?: number;
    year_to?: number;
    sort_by?: string;
    task_type?: string;
    top_k?: number;
  }) => request<any>("POST", "/api/search", { body }),

  chat: {
    send: (body: {
      conversation_id?: string;
      message?: string;
      messages?: any[];
      task_type?: string;
    }) => request<any>("POST", "/api/chat", { body }),

    conversations: () => request<any>("GET", "/api/conversations"),
  },

  // ---------- 投稿 ----------
  venues: {
    list: (query?: {
      page?: number;
      page_size?: number;
      keyword?: string;
      kind?: string;
      sort_by?: string;
    }) => request<any>("GET", "/api/venues", { query }),
    match: (body: {
      title: string;
      abstract: string;
      keywords?: string[];
    }) => request<any>("POST", "/api/submission/match", { body }),
  },

  // ---------- 文献库 ----------
  library: {
    folders: {
      list: () => request<any>("GET", "/api/library/folders"),
      create: (name: string) =>
        request<any>("POST", "/api/library/folders", { body: { name } }),
    },
    list: (query?: {
      folder?: string;
      tag?: string;
      status?: string;
      sort_by?: string;
      page?: number;
      page_size?: number;
    }) => request<any>("GET", "/api/library", { query }),
    add: (body: {
      paper_id?: string;
      title: string;
      venue?: string;
      arxiv?: string;
      authors?: string;
      folder?: string;
      tags?: string[];
    }) => request<any>("POST", "/api/library", { body }),
    remove: (ids: string[]) =>
      request<any>("POST", "/api/library/batch-delete", { body: { ids } }),
    updateProgress: (id: string, progress: number) =>
      request<any>("PUT", `/api/library/${id}/progress`, {
        body: { progress },
      }),
  },

  // ---------- 通知 ----------
  notifications: {
    list: () => request<any>("GET", "/api/notifications"),
    markRead: (id: string) =>
      request<any>("PUT", `/api/notifications/${id}/read`),
  },

  // ---------- 开题报告/综述 ----------
  proposal: {
    generate: (body: {
      type: "proposal" | "review";
      topic?: string;
      papers_count?: number;
    }) => request<any>("POST", "/api/proposal/generate", { body }),
  },
};

export default client;
export { ApiError };

// ==================== 低层函数（供 services.ts / 组件直接调用） ====================

/** GET 请求，返回统一响应结构（含 data/success/pagination） */
export async function apiGet<T = any>(
  path: string,
  query?: Record<string, any>
): Promise<ApiResp<T>> {
  return request<T>("GET", path, { query });
}

/** POST 请求 */
export async function apiPost<T = any>(
  path: string,
  body?: any
): Promise<ApiResp<T>> {
  return request<T>("POST", path, { body });
}

/** PUT 请求 */
export async function apiPut<T = any>(
  path: string,
  body?: any
): Promise<ApiResp<T>> {
  return request<T>("PUT", path, { body });
}

/** DELETE 请求 */
export async function apiDelete<T = any>(
  path: string,
  body?: any
): Promise<ApiResp<T>> {
  return request<T>("DELETE", path, { body });
}

/** SSE 流式事件（对应后端 /api/chat/stream、/api/translate/stream 协议） */
export type ChatStreamEvent =
  | {
      type: "meta";
      meta: {
        conversation_id?: string;
        run_id?: string;
        workflow?: unknown;
        generated_files?: unknown;
        references?: unknown;
        tokens?: number;
        target_lang?: string;
      };
    }
  | { type: "delta"; text: string }
  | { type: "done" };

/**
 * 解析后端 SSE 协议：
 *   event: meta  → 元信息（工作流/生成文件）
 *   data: {"choices":[{"delta":{"content":"..."}}]} → 增量文本
 *   event: done  → 结束
 */
export async function* streamChat(
  path: string,
  body: unknown,
  signal?: AbortSignal
): AsyncGenerator<ChatStreamEvent, void, unknown> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(API_BASE + path, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw new ApiError(`API ${res.status}: ${path}`, res.status);
  if (!res.body) throw new ApiError("流式响应缺少 body", res.status);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let idx: number;
      // 兼容 \n\n 与 \r\n\r\n 分隔(SSE 规范允许 CRLF)
      while ((idx = buffer.search(/\r?\n\r?\n/)) >= 0) {
        const sepLen = buffer.slice(idx).match(/^(\r?\n){2}/)?.[0].length ?? 2;
        const raw = buffer.slice(0, idx);
        buffer = buffer.slice(idx + sepLen);

        let event = "message";
        const dataLines: string[] = [];
        for (const line of raw.split(/\r?\n/)) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          else if (line.startsWith("data:")) dataLines.push(line.slice(5));
        }
        if (!dataLines.length) continue;
        // SSE 规范:多个 data 行以 \n 连接
        const data = dataLines.join("\n");

        if (event === "done") {
          yield { type: "done" };
          return;
        }
        try {
          const json = JSON.parse(data) as {
            choices?: { delta?: { content?: string } }[];
          };
          if (event === "meta") {
            yield { type: "meta", meta: json as never };
            continue;
          }
          const text = json?.choices?.[0]?.delta?.content ?? "";
          if (text) yield { type: "delta", text };
        } catch {
          // 忽略无法解析的分片
        }
      }
    }
    yield { type: "done" };
  } finally {
    // 消费方提前退出(break/abort/组件卸载)时断开底层连接,避免空转耗流
    reader.cancel().catch(() => {});
  }
}
