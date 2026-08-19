/**
 * API 通用工具函数
 */
import { NextResponse } from "next/server";
import { runSeed } from "./seed";
export { hashPassword, verifyPassword } from "./password";

// 首次调用时自动执行种子数据初始化
let seedInitialized = false;
export function ensureSeed() {
  if (!seedInitialized) {
    runSeed();
    seedInitialized = true;
  }
}

/** 成功响应（200） */
export function ok<T = any>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data, success: true }, { status: 200, ...init });
}

/** 带分页的成功响应，可通过 extra 追加额外顶层字段（如 stats） */
export function okPaginated<T = any>(
  data: T[],
  page: number,
  pageSize: number,
  total: number,
  extra?: Record<string, any>
) {
  return NextResponse.json({
    data,
    success: true,
    pagination: {
      page,
      page_size: pageSize,
      total,
      total_pages: Math.ceil(total / pageSize),
    },
    ...(extra || {}),
  });
}

/** 失败响应 */
export function fail(message: string, status = 400, code?: string) {
  return NextResponse.json(
    { error: message, success: false, code },
    { status }
  );
}

/** 从请求中提取 JSON body，带类型转换 */
export async function parseBody<T = any>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new Error("Invalid JSON body");
  }
}

/** 从 URL 中获取查询参数 */
export function getQuery(req: Request, key: string, fallback?: string): string | undefined {
  const url = new URL(req.url);
  return url.searchParams.get(key) ?? fallback;
}

export function getQueryInt(req: Request, key: string, fallback: number): number {
  const v = getQuery(req, key);
  if (v == null) return fallback;
  const n = parseInt(v, 10);
  return isNaN(n) ? fallback : n;
}

/** 解析分页参数，统一做边界钳制 */
export function getPagination(req: Request, defaultSize = 20, maxSize = 100) {
  const page = Math.max(1, getQueryInt(req, "page", 1));
  const pageSize = Math.min(maxSize, Math.max(1, getQueryInt(req, "page_size", defaultSize)));
  return { page, pageSize };
}

/** 生成简单的伪 UUID */
export function genId(prefix = ""): string {
  return prefix + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/** 对话请求体结构（chat / chat/stream 共用） */
export interface ChatLikeBody {
  message?: string;
  messages?: { role: string; content: string }[];
}

/** 从对话请求体中提取最后一条用户消息 */
export function extractMessage(body: ChatLikeBody): string {
  if (body.message) return body.message;
  if (body.messages && body.messages.length) {
    for (let i = body.messages.length - 1; i >= 0; i--) {
      if (body.messages[i].role === "user" && body.messages[i].content) {
        return body.messages[i].content;
      }
    }
  }
  return "";
}
