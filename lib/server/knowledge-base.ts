/**
 * 远程知识底座客户端。
 *
 * 仅在服务端 Route Handler 中使用：统一处理超时、有限重试、字段归一化，
 * 并避免把知识底座地址暴露给浏览器。
 */

export type RetrievalProvider = "remote" | "local" | "hybrid";

export interface KnowledgeSearchInput {
  query: string;
  topK?: number;
  yearFrom?: number;
  yearTo?: number;
  conferences?: string[];
  authors?: string[];
  keywords?: string[];
  subjects?: string[];
}

export interface KnowledgePaper {
  paperId: string;
  title: string;
  abstract: string;
  venue: string;
  year: number | null;
  authors: string[];
  keywords: string[];
  subjects: string[];
  score: number | null;
  rank: number | null;
  doi?: string | null;
  pdfUrl?: string | null;
}

export interface KnowledgeSearchResult {
  results: KnowledgePaper[];
  state: Record<string, unknown>;
  queryParse: Record<string, unknown>;
  queryRewrite: Record<string, unknown>;
  tookMs: number;
}

export interface KnowledgeGraphNode {
  id: string;
  title: string;
  label: string;
  type: string;
  year: number | null;
  authors: string[];
  venue: string;
  abstract: string;
}

export interface KnowledgeGraphLine {
  from: string;
  to: string;
  text: string;
  data: Record<string, unknown>;
}

export interface KnowledgeGraph {
  rootId: string;
  nodes: KnowledgeGraphNode[];
  lines: KnowledgeGraphLine[];
  provenance?: Record<string, unknown>;
}

const DEFAULT_API_URL = "http://47.110.47.12";

type CircuitState = {
  failures: number;
  openedAt: number | null;
  requests: number;
  successes: number;
  failuresTotal: number;
  fallbacks: number;
  latencies: number[];
};

export type KnowledgeErrorCode =
  | "NOT_FOUND"
  | "INVALID_ARGUMENT"
  | "RATE_LIMITED"
  | "UPSTREAM_UNAVAILABLE"
  | "TIMEOUT"
  | "CONTRACT_VIOLATION"
  | "UNKNOWN";

const circuit: CircuitState = {
  failures: 0, openedAt: null, requests: 0, successes: 0, failuresTotal: 0, fallbacks: 0, latencies: [],
};

function integerEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
}

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function remoteBaseUrl(): string {
  const value = (process.env.RETRIEVAL_API_URL || DEFAULT_API_URL).replace(/\/$/, "");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new KnowledgeBaseError("RETRIEVAL_API_URL 必须是有效的 http(s) 地址");
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new KnowledgeBaseError("RETRIEVAL_API_URL 仅支持 http(s) 协议");
  }
  const allowInsecure = ["1", "true", "yes"].includes((process.env.RETRIEVAL_ALLOW_INSECURE_HTTP || "").toLowerCase());
  if (isProduction() && url.protocol !== "https:" && !allowInsecure) {
    throw new KnowledgeBaseError("生产环境知识底座必须使用 HTTPS；仅受控内网可设置 RETRIEVAL_ALLOW_INSECURE_HTTP=true");
  }
  return url.toString().replace(/\/$/, "");
}

function circuitOpen(): boolean {
  if (!circuit.openedAt) return false;
  const resetMs = integerEnv("RETRIEVAL_CIRCUIT_RESET_SECONDS", 30) * 1000;
  if (Date.now() - circuit.openedAt >= resetMs) {
    circuit.openedAt = null;
    circuit.failures = 0;
    return false;
  }
  return true;
}

function recordRequest(success: boolean, startedAt: number, fallback = false) {
  circuit.requests += 1;
  circuit.latencies.push(Date.now() - startedAt);
  if (circuit.latencies.length > 200) circuit.latencies.shift();
  if (fallback) circuit.fallbacks += 1;
  if (success) {
    circuit.successes += 1;
    circuit.failures = 0;
    return;
  }
  circuit.failuresTotal += 1;
  circuit.failures += 1;
  if (circuit.failures >= integerEnv("RETRIEVAL_CIRCUIT_FAILURE_THRESHOLD", 3)) circuit.openedAt = Date.now();
}

export function knowledgeBaseRuntimeStatus() {
  const sorted = [...circuit.latencies].sort((a, b) => a - b);
  const p95 = sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)] : null;
  return {
    circuit: circuitOpen() ? "open" : "closed",
    retryAt: circuit.openedAt
      ? new Date(circuit.openedAt + integerEnv("RETRIEVAL_CIRCUIT_RESET_SECONDS", 30) * 1000).toISOString()
      : null,
    retryAfterMs: circuit.openedAt
      ? Math.max(0, circuit.openedAt + integerEnv("RETRIEVAL_CIRCUIT_RESET_SECONDS", 30) * 1000 - Date.now())
      : 0,
    requests: circuit.requests,
    successes: circuit.successes,
    failures: circuit.failuresTotal,
    fallbackRate: circuit.requests ? circuit.fallbacks / circuit.requests : 0,
    p95Ms: p95,
  };
}

export function retrievalProvider(): RetrievalProvider {
  const value = (process.env.RETRIEVAL_PROVIDER || "remote").toLowerCase();
  return value === "local" || value === "hybrid" ? value : "remote";
}

export function shouldUseRemoteKnowledgeBase(): boolean {
  return retrievalProvider() !== "local";
}

export function shouldFallbackToLocal(): boolean {
  return !["0", "false", "no", "off"].includes(
    (process.env.RETRIEVAL_FALLBACK_LOCAL || "true").toLowerCase(),
  );
}

function asString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object") {
    const item = value as Record<string, unknown>;
    return asString(item.name ?? item.display_name ?? item.title ?? item.id);
  }
  return value == null ? "" : String(value);
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return asString(value) ? [asString(value)] : [];
  return value.map(asString).filter(Boolean);
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function normalizeKnowledgePaper(raw: unknown): KnowledgePaper {
  const item = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    paperId: asString(item.paper_id ?? item.paperId ?? item.id),
    title: asString(item.title),
    abstract: asString(item.abstract),
    venue: asString(item.venue ?? item.conference),
    year: numberOrNull(item.year),
    authors: stringList(item.authors ?? item.author),
    keywords: stringList(item.keywords),
    subjects: stringList(item.subjects),
    score: numberOrNull(item.score),
    rank: numberOrNull(item.rank),
    doi: asString(item.doi) || null,
    pdfUrl: asString(item.pdf_url ?? item.pdfUrl) || null,
  };
}

export function toFrontendKnowledgePaper(paper: KnowledgePaper) {
  return {
    id: paper.paperId,
    title: paper.title,
    // 空数组表示上游未提供作者，不在服务端制造看似真实的占位作者。
    authors: paper.authors.join(", "),
    author_list: paper.authors,
    affiliation: null,
    venue: paper.venue || "未知来源",
    ccf: null,
    year: paper.year,
    date: paper.year ? `${paper.year}-01-01` : null,
    abstract: paper.abstract,
    tags: [...new Set([...paper.keywords, ...paper.subjects])],
    keywords: paper.keywords,
    subjects: paper.subjects,
    citations: 0,
    doi: paper.doi ?? null,
    pdf_url: paper.pdfUrl ?? null,
    relevance: paper.score,
    knowledgeScore: paper.score,
    rank: paper.rank,
    source: "remote_knowledge_base",
    match: "partial",
    matchLabel: "partial",
  };
}

export class KnowledgeBaseError extends Error {
  readonly status?: number;
  readonly code: KnowledgeErrorCode;

  constructor(message: string, status?: number, code: KnowledgeErrorCode = "UNKNOWN") {
    super(message);
    this.name = "KnowledgeBaseError";
    this.status = status;
    this.code = code;
  }
}

export function knowledgeErrorPayload(error: unknown, fallback = "知识底座暂不可用") {
  if (error instanceof KnowledgeBaseError) {
    return { code: error.code, message: error.message, status: error.status ?? 503 };
  }
  if (error instanceof Error && error.name === "AbortError") {
    return { code: "TIMEOUT" as const, message: "知识底座请求超时", status: 504 };
  }
  return { code: "UPSTREAM_UNAVAILABLE" as const, message: fallback, status: 503 };
}

export function resetKnowledgeCircuit() {
  circuit.failures = 0;
  circuit.openedAt = null;
}

async function requestJson<T>(
  path: string,
  init?: RequestInit,
  options: { bypassCircuit?: boolean; trackCircuit?: boolean } = {},
): Promise<T> {
  if (!options.bypassCircuit && circuitOpen()) {
    const { retryAfterMs } = knowledgeBaseRuntimeStatus();
    throw new KnowledgeBaseError(`知识底座熔断中，约 ${Math.ceil(retryAfterMs / 1000)} 秒后自动恢复，也可手动重试`, 503, "UPSTREAM_UNAVAILABLE");
  }
  const base = remoteBaseUrl();
  const timeoutMs = integerEnv("RETRIEVAL_TIMEOUT_SECONDS", 30) * 1000;
  // 与深知知识底座契约一致：最多自动重试一次，避免放大上游压力。
  const retries = Math.min(1, integerEnv("RETRIEVAL_RETRY_COUNT", 1));
  const startedAt = Date.now();
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${base}${path}`, {
        ...init,
        headers: {
          Accept: "application/json",
          ...(process.env.RETRIEVAL_API_TOKEN ? { Authorization: `Bearer ${process.env.RETRIEVAL_API_TOKEN}` } : {}),
          ...(init?.headers || {}),
        },
        signal: controller.signal,
        cache: "no-store",
      });
      if (!response.ok) {
        // 不把上游响应正文直接透传给浏览器，避免泄露 URL、堆栈或内部配置。
        const error = new KnowledgeBaseError(
          response.status === 400 ? "知识底座请求参数无效" : response.status === 404 ? "论文或知识底座资源不存在" : response.status === 429 ? "知识底座请求过于频繁" : "知识底座请求失败",
          response.status,
          response.status === 400 ? "INVALID_ARGUMENT" : response.status === 404 ? "NOT_FOUND" : response.status === 429 ? "RATE_LIMITED" : response.status >= 500 ? "UPSTREAM_UNAVAILABLE" : "UNKNOWN",
        );
        if (![500, 503].includes(response.status) || attempt === retries) throw error;
        lastError = error;
      } else {
        const data = (await response.json()) as T;
        if (options.trackCircuit !== false) recordRequest(true, startedAt);
        return data;
      }
    } catch (error) {
      lastError = error;
      if (error instanceof KnowledgeBaseError && ![500, 503].includes(error.status ?? 0)) {
        throw error;
      }
      if (attempt === retries) break;
    } finally {
      clearTimeout(timer);
    }
  }
  if (options.trackCircuit !== false) recordRequest(false, startedAt);
  if (lastError instanceof KnowledgeBaseError) throw lastError;
  if (lastError instanceof Error && lastError.name === "AbortError") {
    throw new KnowledgeBaseError("知识底座请求超时", 504, "TIMEOUT");
  }
  throw new KnowledgeBaseError("知识底座暂不可用", 503, "UPSTREAM_UNAVAILABLE");
}

export function recordKnowledgeFallback() {
  circuit.fallbacks += 1;
}

export async function searchKnowledgeBase(input: KnowledgeSearchInput): Promise<KnowledgeSearchResult> {
  const started = Date.now();
  const payload = {
    query: input.query,
    top_k: Math.min(50, Math.max(1, input.topK ?? integerEnv("RETRIEVAL_DEFAULT_TOP_K", 10))),
    year_gte: input.yearFrom,
    year_lte: input.yearTo,
    conference: input.conferences ?? [],
    author: input.authors ?? [],
    keyword: input.keywords ?? [],
    subject: input.subjects ?? [],
  };
  const raw = await requestJson<Record<string, unknown>>("/api/retrieval/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!Array.isArray(raw.results)) {
    throw new KnowledgeBaseError("知识底座返回格式不符合约定", 502, "CONTRACT_VIOLATION");
  }
  const results = raw.results.map(normalizeKnowledgePaper);
  return {
    results: results.filter((paper) => paper.paperId),
    state: (raw.state as Record<string, unknown>) ?? {},
    queryParse: (raw.query_parse as Record<string, unknown>) ?? {},
    queryRewrite: (raw.query_rewrite as Record<string, unknown>) ?? {},
    tookMs: Date.now() - started,
  };
}

export async function getKnowledgePaper(paperId: string): Promise<KnowledgePaper> {
  const raw = await requestJson<unknown>(`/api/kg/paper?paperId=${encodeURIComponent(paperId)}`);
  const paper = normalizeKnowledgePaper(raw);
  if (!paper.paperId || !paper.title) {
    throw new KnowledgeBaseError("知识底座论文详情格式不完整", 502, "CONTRACT_VIOLATION");
  }
  if (paper.paperId !== paperId) {
    throw new KnowledgeBaseError("知识底座返回的论文 ID 不匹配", 502, "CONTRACT_VIOLATION");
  }
  return paper;
}

export function normalizeKnowledgeGraph(raw: unknown): KnowledgeGraph {
  const value = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const nodes = Array.isArray(value.nodes) ? value.nodes : [];
  const lines = Array.isArray(value.lines) ? value.lines : [];
  return {
    rootId: asString(value.rootId ?? value.root_id),
    nodes: nodes.map((node) => {
      const item = (node && typeof node === "object" ? node : {}) as Record<string, unknown>;
      const data = (item.data && typeof item.data === "object" ? item.data : {}) as Record<string, unknown>;
      return {
        id: asString(item.id ?? item.paper_id ?? data.id),
        title: asString(item.title ?? data.title ?? item.label),
        label: asString(item.label ?? item.title ?? data.title),
        type: asString(item.type ?? data.type) || "PAPER",
        year: numberOrNull(item.year ?? data.year),
        authors: stringList(item.authors ?? data.authors),
        venue: asString(item.venue ?? item.conference ?? data.venue ?? data.conference),
        abstract: asString(item.abstract ?? data.abstract),
      };
    }).filter((node) => node.id),
    lines: lines.map((line) => {
      const item = (line && typeof line === "object" ? line : {}) as Record<string, unknown>;
      return {
        from: asString(item.from),
        to: asString(item.to),
        text: asString(item.text),
        data: (item.data && typeof item.data === "object" ? item.data : {}) as Record<string, unknown>,
      };
    }).filter((line) => line.from && line.to),
    provenance: (value.provenance && typeof value.provenance === "object")
      ? value.provenance as Record<string, unknown>
      : undefined,
  };
}

export async function getKnowledgeGraph(paperId: string, depth = 1): Promise<KnowledgeGraph> {
  const safeDepth = Math.min(3, Math.max(1, depth));
  const raw = await requestJson<unknown>(
    `/api/kg/graph?paperId=${encodeURIComponent(paperId)}&depth=${safeDepth}`,
  );
  const graph = normalizeKnowledgeGraph(raw);
  if (!graph.rootId || graph.rootId !== paperId) {
    throw new KnowledgeBaseError("知识底座图谱根节点不匹配", 502, "CONTRACT_VIOLATION");
  }
  return graph;
}

export async function getKnowledgeHealth() {
  const endpoints = {
    service: "/api/health",
    retrieval: "/api/retrieval/health",
    ready: "/api/retrieval/ready",
  } as const;
  const checks = Object.fromEntries(await Promise.all(Object.entries(endpoints).map(async ([name, path]) => {
    try {
      const data = await requestJson<Record<string, unknown>>(path, undefined, { bypassCircuit: true, trackCircuit: false });
      return [name, { ok: true, data }] as const;
    } catch (error) {
      return [name, { ok: false, error: knowledgeErrorPayload(error) }] as const;
    }
  }))) as Record<keyof typeof endpoints, { ok: boolean; data?: Record<string, unknown>; error?: ReturnType<typeof knowledgeErrorPayload> }>;
  const okCount = Object.values(checks).filter((check) => check.ok).length;
  return {
    status: okCount === 3 ? "ready" : okCount ? "degraded" : "unavailable",
    checks,
  };
}

/** 供筛选 UI 使用的知识底座元数据；路径白名单避免代理任意远程地址。 */
export async function getKnowledgeMetadata(
  kind: "venues" | "tracks" | "categories" | "conferences",
  conference?: string,
) {
  const paths = {
    venues: "/api/papers/venues",
    tracks: "/api/papers/tracks",
    categories: "/api/categories",
    conferences: "/api/conferences",
  } as const;
  const query = kind === "tracks" && conference ? `?conference=${encodeURIComponent(conference)}` : "";
  return requestJson<unknown>(`${paths[kind]}${query}`);
}
