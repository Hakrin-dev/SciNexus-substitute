/**
 * GET /api/papers/[id]
 * 获取论文详情
 */
import { NextRequest } from "next/server";
import { ensureSeed, fail, ok } from "@/lib/server/utils";
import { getDB, jsonParse } from "@/lib/server/db";
import {
  getKnowledgePaper,
  recordKnowledgeFallback,
  shouldFallbackToLocal,
  shouldUseRemoteKnowledgeBase,
  toFrontendKnowledgePaper,
} from "@/lib/server/knowledge-base";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    if (shouldUseRemoteKnowledgeBase()) {
      try {
        const remote = toFrontendKnowledgePaper(await getKnowledgePaper(id));
        return ok({
          ...remote,
          authors: remote.author_list,
          fallbackUsed: false,
          hasFulltext: false,
          page: { current: 1, total: 1 },
          toc: [{ id: "abstract", label: "摘要 Abstract", active: true }],
      introduction: remote.abstract,
        });
      } catch (error) {
        console.warn(`[scinexus] 远程论文详情失败: ${id}`, error);
        if (!shouldFallbackToLocal()) {
          return fail(error instanceof Error ? error.message : "知识底座暂不可用", 502);
        }
        recordKnowledgeFallback();
      }
    }

    ensureSeed();
    const db = getDB();
    const row = db.prepare("SELECT * FROM papers WHERE id = ?").get(id) as any;
    if (!row) {
      return fail("论文未找到", 404);
    }
    // 论文详情：返回阅读器结构
    const data = {
      id: row.id,
      title: row.title,
      authors: row.authors.split(/[,，·]+/).map((s: string) => s.trim()).filter(Boolean),
      affiliation: row.institute || "Tsinghua University · Shanghai AI Lab",
      likes: row.likes,
      page: { current: 1, total: 18 },
      toc: [
        { id: "abstract", label: "摘要 Abstract", active: true },
        { id: "intro", label: "1. 引言" },
        { id: "related", label: "2. 相关工作" },
        { id: "method", label: "3. 方法" },
        { id: "exp", label: "4. 实验" },
        { id: "conclusion", label: "5. 结论" },
      ],
      abstract: row.abstract,
      introduction:
        "Recent advances in generative modeling have unlocked new capabilities in language and vision, yet robotics still relies heavily on task-specific imitation learning. " +
        "This work presents a novel approach that addresses the data bottleneck through large-scale pretraining and efficient transfer learning.",
      venue: row.venue,
      date: row.date,
      tags: jsonParse<string[]>(row.tags_json, []),
      citations: row.citations,
      ccf: row.ccf,
      year: row.year,
      doi: row.doi,
      source: "local",
      fallbackUsed: shouldUseRemoteKnowledgeBase(),
      hasFulltext: false,
    };
    return ok(data);
  } catch (e: any) {
    return fail(e.message || "获取论文详情失败");
  }
}
