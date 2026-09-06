import { NextRequest } from "next/server";
import { knowledgeErrorResponse, knowledgeInvalidArgument, knowledgeOk } from "@/lib/server/knowledge-api";
import { getKnowledgePaper, KnowledgeBaseError, shouldUseRemoteKnowledgeBase } from "@/lib/server/knowledge-base";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const paperId = new URL(request.url).searchParams.get("paperId")?.trim();
  if (!paperId || paperId.length > 512) return knowledgeInvalidArgument(request, "paperId 不能为空");
  if (!shouldUseRemoteKnowledgeBase()) return knowledgeErrorResponse(request, new KnowledgeBaseError("当前检索 provider 未启用远程知识底座", 503, "UPSTREAM_UNAVAILABLE"));
  try {
    return knowledgeOk({ paper: await getKnowledgePaper(paperId), meta: { source: "remote_knowledge_base" } });
  } catch (error) {
    return knowledgeErrorResponse(request, error);
  }
}
