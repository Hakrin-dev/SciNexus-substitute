/**
 * GET /api/papers/[id]
 * 获取论文详情
 */
import { NextRequest } from "next/server";
import { ensureSeed, fail, ok } from "@/lib/server/utils";
import { getDB, jsonParse } from "@/lib/server/db";
import {
  getKnowledgePaper,
  findKnowledgePaperByTitle,
  recordKnowledgeFallback,
  shouldFallbackToLocal,
  shouldUseRemoteKnowledgeBase,
  toFrontendKnowledgePaper,
} from "@/lib/server/knowledge-base";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const requestedSource = new URL(req.url).searchParams.get("source");
  const requestedTitle = new URL(req.url).searchParams.get("title")?.trim();
  const preferRemote = requestedSource === "remote_knowledge_base";
  try {
    ensureSeed();
    const db = getDB();
    const localRow = db.prepare("SELECT * FROM papers WHERE id = ?").get(id) as any;
    // A remote search result must remain remote through the reader. Otherwise a
    // colliding local ID can silently show a different paper to the user.
    if (preferRemote && shouldUseRemoteKnowledgeBase()) {
      try {
        let knowledgePaper: Awaited<ReturnType<typeof getKnowledgePaper>>;
        try {
          knowledgePaper = await getKnowledgePaper(id);
        } catch (error) {
          if (!requestedTitle) throw error;
          knowledgePaper = await findKnowledgePaperByTitle(requestedTitle);
        }
        const remote = toFrontendKnowledgePaper(knowledgePaper);
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
        if (!shouldFallbackToLocal()) {
          return fail(error instanceof Error ? error.message : "知识底座暂不可用", 502);
        }
        recordKnowledgeFallback();
      }
    }
    if (localRow) {
      return ok({
        id: localRow.id,
        title: localRow.title,
        authors: localRow.authors.split(/[,，·]+/).map((s: string) => s.trim()).filter(Boolean),
        affiliation: localRow.institute || "未提供机构信息",
        likes: localRow.likes,
        page: { current: 1, total: 1 },
        toc: [{ id: "abstract", label: "摘要 Abstract", active: true }],
        abstract: localRow.abstract || "暂无摘要",
        introduction: "",
        venue: localRow.venue,
        date: localRow.date,
        tags: jsonParse<string[]>(localRow.tags_json, []),
        citations: localRow.citations,
        ccf: localRow.ccf,
        year: localRow.year,
        doi: localRow.doi,
        source: "local",
        fallbackUsed: false,
        hasFulltext: false,
        pdfUrl: localRow.pdf_url || null,
      });
    }

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
