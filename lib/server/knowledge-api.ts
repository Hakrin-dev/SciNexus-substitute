import { NextResponse } from "next/server";
import { KnowledgeBaseError, type KnowledgeErrorCode } from "@/lib/server/knowledge-base";

export const KNOWLEDGE_ERROR_CODES = new Set<KnowledgeErrorCode>([
  "NOT_FOUND",
  "INVALID_ARGUMENT",
  "RATE_LIMITED",
  "UPSTREAM_UNAVAILABLE",
  "TIMEOUT",
  "CONTRACT_VIOLATION",
  "UNKNOWN",
]);

export type KnowledgeApiError = {
  code: KnowledgeErrorCode;
  message: string;
  retryable: boolean;
  requestId: string;
};

function requestId(request: Request): string {
  const supplied = request.headers.get("x-request-id")?.trim();
  return supplied && supplied.length <= 128 ? supplied : crypto.randomUUID();
}

function retryable(code: KnowledgeErrorCode): boolean {
  return code === "RATE_LIMITED" || code === "UPSTREAM_UNAVAILABLE" || code === "TIMEOUT";
}

export function knowledgeErrorResponse(request: Request, error: unknown): NextResponse {
  const id = requestId(request);
  if (error instanceof KnowledgeBaseError) {
    const code = KNOWLEDGE_ERROR_CODES.has(error.code) ? error.code : "UNKNOWN";
    const status = error.status && error.status >= 400 && error.status <= 599 ? error.status : 503;
    return NextResponse.json({
      success: false,
      error: { code, message: error.message, retryable: retryable(code), requestId: id },
    }, { status });
  }
  return NextResponse.json({
    success: false,
    error: {
      code: "UNKNOWN",
      message: "知识服务请求失败",
      retryable: false,
      requestId: id,
    } satisfies KnowledgeApiError,
  }, { status: 500 });
}

export function knowledgeInvalidArgument(request: Request, message: string): NextResponse {
  return NextResponse.json({
    success: false,
    error: {
      code: "INVALID_ARGUMENT",
      message,
      retryable: false,
      requestId: requestId(request),
    } satisfies KnowledgeApiError,
  }, { status: 422 });
}

export function knowledgeOk<T>(data: T): NextResponse {
  return NextResponse.json({ success: true, data });
}
