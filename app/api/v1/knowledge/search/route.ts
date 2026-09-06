import { NextRequest } from "next/server";
import { knowledgeErrorResponse, knowledgeInvalidArgument, knowledgeOk } from "@/lib/server/knowledge-api";
import { KnowledgeBaseError, searchKnowledgeBase, shouldUseRemoteKnowledgeBase } from "@/lib/server/knowledge-base";

export const runtime = "nodejs";

type SearchBody = {
  query?: unknown;
  topK?: unknown;
  yearFrom?: unknown;
  yearTo?: unknown;
  venue?: unknown;
  author?: unknown;
  keyword?: unknown;
  subject?: unknown;
};

function optionalInteger(value: unknown): number | undefined | null {
  if (value === undefined) return undefined;
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function optionalStrings(value: unknown): string[] | undefined | null {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) return null;
  return value.map((item) => item.trim()).filter(Boolean);
}

export async function POST(request: NextRequest) {
  let body: SearchBody;
  try {
    body = await request.json() as SearchBody;
  } catch {
    return knowledgeInvalidArgument(request, "检索请求必须是 JSON");
  }
  const query = typeof body.query === "string" ? body.query.trim() : "";
  const topK = optionalInteger(body.topK);
  const yearFrom = optionalInteger(body.yearFrom);
  const yearTo = optionalInteger(body.yearTo);
  const venue = optionalStrings(body.venue);
  const author = optionalStrings(body.author);
  const keyword = optionalStrings(body.keyword);
  const subject = optionalStrings(body.subject);
  if (!query || query.length > 500 || topK === null || topK !== undefined && (topK < 1 || topK > 50)
    || yearFrom === null || yearTo === null || yearFrom !== undefined && yearTo !== undefined && yearFrom > yearTo
    || venue === null || author === null || keyword === null || subject === null) {
    return knowledgeInvalidArgument(request, "检索参数不合法");
  }
  if (!shouldUseRemoteKnowledgeBase()) {
    return knowledgeErrorResponse(request, new KnowledgeBaseError("当前检索 provider 未启用远程知识底座", 503, "UPSTREAM_UNAVAILABLE"));
  }
  try {
    const result = await searchKnowledgeBase({ query, topK, yearFrom, yearTo, conferences: venue, authors: author, keywords: keyword, subjects: subject });
    return knowledgeOk({
      results: result.results,
      meta: { source: "remote_knowledge_base", tookMs: result.tookMs, queryParse: result.queryParse, queryRewrite: result.queryRewrite, state: result.state },
    });
  } catch (error) {
    return knowledgeErrorResponse(request, error);
  }
}
