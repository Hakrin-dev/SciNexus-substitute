/** GET /api/knowledge/health - 服务端代理知识底座健康状态。 */
import { NextResponse } from "next/server";
import { getKnowledgeHealth, knowledgeBaseRuntimeStatus, retrievalProvider } from "@/lib/server/knowledge-base";

export const runtime = "nodejs";

export async function GET() {
  const checkedAt = new Date().toISOString();
  const started = Date.now();
  try {
    const data = await getKnowledgeHealth();
    return NextResponse.json({
      success: true,
      data: {
        status: "ready",
        provider: retrievalProvider(),
        source: "remote_knowledge_base",
        checkedAt,
        tookMs: Date.now() - started,
        runtime: knowledgeBaseRuntimeStatus(),
        checks: {
          service: { ok: true, data: data.service },
          retrieval: { ok: true, data: data.retrieval },
          ready: { ok: true, data: data.ready },
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "知识底座暂不可用";
    return NextResponse.json(
      {
        success: false,
        error: message,
        data: {
          status: "unavailable",
          provider: retrievalProvider(),
          checkedAt,
          tookMs: Date.now() - started,
          runtime: knowledgeBaseRuntimeStatus(),
          checks: { knowledgeBase: { ok: false, error: message } },
        },
      },
      { status: 503 },
    );
  }
}
