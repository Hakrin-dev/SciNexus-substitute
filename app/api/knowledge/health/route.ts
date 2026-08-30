/** GET /api/knowledge/health - 服务端代理知识底座健康状态。 */
import { NextResponse } from "next/server";
import { getKnowledgeHealth, retrievalProvider } from "@/lib/server/knowledge-base";

export const runtime = "nodejs";

export async function GET() {
  try {
    const data = await getKnowledgeHealth();
    return NextResponse.json({
      success: true,
      data: { ...data, provider: retrievalProvider(), source: "remote_knowledge_base" },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "知识底座暂不可用" },
      { status: 503 },
    );
  }
}
