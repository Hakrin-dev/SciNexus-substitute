/**
 * 研枢前端 API 调用客户端
 * 统一封装所有后端接口调用，统一处理响应结构。
 * Next.js 认证会话只通过 HttpOnly Cookie 传递，不在浏览器存储 token。
 *
 * 使用：
 *   import api from '@/lib/api/client';
 *   const resp = await api.auth.login(username, password);
 */

// 后端基础地址:默认同源(空字符串 → 相对路径 /api/*,命中 Next.js 自带 Route Handlers);
// 可通过 NEXT_PUBLIC_API_URL 或运行时 window.__API_BASE__ 覆盖为外部 FastAPI 服务
export const API_BASE =
  (typeof window !== "undefined"
    ? window.__API_BASE__ || process.env.NEXT_PUBLIC_API_URL
    : process.env.NEXT_PUBLIC_API_URL) || "";

export function getToken(): string | null {
  // 保留接口兼容性；Cookie token 对 JavaScript 不可读，因此始终返回 null。
  return null;
}

export function setToken(token: string | null) {
  // 认证 token 由服务端通过 HttpOnly Cookie 管理，禁止写入 localStorage。
  void token;
}

export interface ApiResp<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  summary?: string;
  /** 匹配等接口的实际执行模式(如 "llm" | "keyword") */
  mode?: string;
  pagination?: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
  stats?: unknown;
  meta?: Record<string, unknown>;
}

export interface ApiUser {
  id: string;
  username: string;
  email: string | null;
  display_name: string | null;
  avatar_color: string;
}

interface AuthResponse {
  user: ApiUser;
}

interface SendOtpResponse {
  challengeId: string;
}

interface VerifyOtpResponse {
  success: boolean;
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

async function request<T = unknown>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  url: string,
  options?: {
    query?: Record<string, unknown>;
    body?: unknown;
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
    credentials: "include",
  });

  let parsed: unknown = null;
  const text = await resp.text();
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }

  if (!resp.ok) {
    const errorPayload = parsed && typeof parsed === "object"
      ? parsed as { error?: unknown; code?: unknown }
      : {};
    const msg = typeof errorPayload.error === "string"
      ? errorPayload.error
      : `HTTP ${resp.status} ${resp.statusText}`;
    const code = typeof errorPayload.code === "string" ? errorPayload.code : undefined;
    throw new ApiError(msg, resp.status, code);
  }

  return (parsed || { success: true }) as ApiResp<T>;
}

export const client = {
  // ---------- 认证 ----------
  auth: {
    login: (username: string, password: string) =>
      request<AuthResponse>("POST", "/api/auth/login", {
        body: { username, password },
        skipAuth: true,
      }),
    register: (params: {
      username: string;
      password: string;
      email?: string;
      displayName?: string;
    }) =>
      request<AuthResponse>("POST", "/api/auth/register", {
        body: params,
        skipAuth: true,
      }),
    me: () => request<ApiUser>("GET", "/api/auth/me"),
    // 注册邮箱验证码
    sendRegisterOtp: (email: string, captchaToken?: string) =>
      request<SendOtpResponse>("POST", "/api/auth/register/send-otp", {
        body: { email },
        skipAuth: true,
        headers: captchaToken ? { "x-captcha-response": captchaToken } : undefined,
      }),
    verifyRegisterOtp: (params: {
      email: string;
      challengeId: string;
      otp: string;
    }) =>
      request<VerifyOtpResponse>("POST", "/api/auth/register/verify-otp", {
        body: params,
        skipAuth: true,
      }),
    // 登录邮箱验证码
    sendLoginOtp: (email: string, captchaToken?: string) =>
      request<SendOtpResponse>("POST", "/api/auth/login/send-otp", {
        body: { email },
        skipAuth: true,
        headers: captchaToken ? { "x-captcha-response": captchaToken } : undefined,
      }),
    verifyLoginOtp: (params: {
      email: string;
      challengeId: string;
      otp: string;
    }) =>
      request<AuthResponse>("POST", "/api/auth/login/verify-otp", {
        body: params,
        skipAuth: true,
      }),
    // 密码重置
    requestPasswordReset: (email: string, captchaToken?: string) =>
      request<{ success: boolean }>("POST", "/api/auth/password/request-reset", {
        body: { email },
        skipAuth: true,
        headers: captchaToken ? { "x-captcha-response": captchaToken } : undefined,
      }),
    resetPassword: (params: { token: string; newPassword: string; confirmPassword: string }) =>
      request<{ success: boolean }>("POST", "/api/auth/password/reset", {
        body: params,
        skipAuth: true,
      }),
  },

  // ---------- 文献库 ----------
  library: {
    add: (body: {
      paper_id?: string;
      title: string;
      venue?: string;
      arxiv?: string;
      authors?: string;
      folder?: string;
      tags?: string[];
    }) => request<unknown>("POST", "/api/library", { body }),
  },
};

export interface CreateProjectInput {
  name: string;
  tagline: string;
  status?: string;
  overview: string[];
  techStack: string[];
  milestones: Record<string, unknown>[];
  members: { name: string; role: string }[];
  links: Record<string, unknown>[];
}

export async function createProject(input: CreateProjectInput): Promise<string> {
  const response = await request<{ id?: unknown }>("POST", "/api/projects", { body: input });
  const id = response.data?.id;
  if (typeof id !== "string" || !id) {
    throw new Error("创建课题失败：后端未返回课题 ID");
  }
  return id;
}

export default client;
export { ApiError };

// ==================== 低层函数（供 services.ts / 组件直接调用） ====================

/** GET 请求，返回统一响应结构（含 data/success/pagination） */
export async function apiGet<T = unknown>(
  path: string,
  query?: Record<string, unknown>
): Promise<ApiResp<T>> {
  return request<T>("GET", path, { query });
}

/** POST 请求 */
export async function apiPost<T = unknown>(
  path: string,
  body?: unknown
): Promise<ApiResp<T>> {
  return request<T>("POST", path, { body });
}

/** PUT 请求 */
export async function apiPut<T = unknown>(
  path: string,
  body?: unknown
): Promise<ApiResp<T>> {
  return request<T>("PUT", path, { body });
}

/** PATCH 请求 */
export async function apiPatch<T = unknown>(
  path: string,
  body?: unknown
): Promise<ApiResp<T>> {
  return request<T>("PATCH", path, { body });
}

/** DELETE 请求 */
export async function apiDelete<T = unknown>(
  path: string,
  body?: unknown
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
    credentials: "include",
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
