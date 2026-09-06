/** GET /api/knowledge/health - 服务端代理知识底座健康状态。 */
import { NextResponse } from "next/server";
import { getKnowledgeHealth, knowledgeBaseRuntimeStatus, retrievalProvider } from "@/lib/server/knowledge-base";

export const runtime = "nodejs";

export async function GET() {
  const checkedAt = new Date().toISOString();
  const started = Date.now();
  const data = await getKnowledgeHealth();
  return NextResponse.json({
    success: data.status !== "unavailable",
    data: {
      status: data.status,
      provider: retrievalProvider(),
      source: "remote_knowledge_base",
      checkedAt,
      tookMs: Date.now() - started,
      runtime: knowledgeBaseRuntimeStatus(),
      checks: data.checks,
    },
  // 健康状态本身是可正常读取的诊断数据；保持 200 让前端能展示具体失败原因。
  }, { status: 200 });
}
