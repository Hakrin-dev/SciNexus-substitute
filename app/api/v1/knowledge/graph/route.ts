import { NextRequest } from "next/server";
import { knowledgeErrorResponse, knowledgeInvalidArgument, knowledgeOk } from "@/lib/server/knowledge-api";
import { getKnowledgeGraph, KnowledgeBaseError, shouldUseRemoteKnowledgeBase } from "@/lib/server/knowledge-base";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  const paperId = params.get("paperId")?.trim();
  const depthText = params.get("depth") ?? "1";
  const depth = Number(depthText);
  if (!paperId || paperId.length > 512 || !Number.isInteger(depth) || (depth !== 1 && depth !== 2)) {
    return knowledgeInvalidArgument(request, "paperId 或 depth 参数不合法");
  }
  if (!shouldUseRemoteKnowledgeBase()) return knowledgeErrorResponse(request, new KnowledgeBaseError("当前检索 provider 未启用远程知识底座", 503, "UPSTREAM_UNAVAILABLE"));
  try {
    return knowledgeOk({ graph: await getKnowledgeGraph(paperId, depth), meta: { source: "remote_knowledge_base" } });
  } catch (error) {
    return knowledgeErrorResponse(request, error);
  }
}
