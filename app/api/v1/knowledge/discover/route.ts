import { NextRequest } from "next/server";
import { knowledgeErrorResponse, knowledgeOk } from "@/lib/server/knowledge-api";
import { getRandomKnowledgePapers, KnowledgeBaseError, shouldUseRemoteKnowledgeBase } from "@/lib/server/knowledge-base";

export const runtime = "nodejs";

/** 首页发现流：每次请求从远程知识底座随机返回 10 篇论文。 */
export async function GET(request: NextRequest) {
  if (!shouldUseRemoteKnowledgeBase()) {
    return knowledgeErrorResponse(
      request,
      new KnowledgeBaseError("当前检索 provider 未启用远程知识底座", 503, "UPSTREAM_UNAVAILABLE"),
    );
  }

  try {
    const results = await getRandomKnowledgePapers(10);
    return knowledgeOk({
      results,
      meta: { source: "remote_knowledge_base", random: true, count: results.length },
    });
  } catch (error) {
    return knowledgeErrorResponse(request, error);
  }
}
