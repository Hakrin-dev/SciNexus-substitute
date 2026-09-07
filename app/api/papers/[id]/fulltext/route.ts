/**
 * GET /api/papers/[id]/fulltext
 * 论文全文分块。当前知识底座未提供正文接口，绝不把摘要伪装成全文。
 */
import { NextRequest, NextResponse } from "next/server";
import { ensureSeed, fail } from "@/lib/server/utils";
import { getDB } from "@/lib/server/db";
import {
  getKnowledgePaper,
  recordKnowledgeFallback,
  shouldFallbackToLocal,
  shouldUseRemoteKnowledgeBase,
} from "@/lib/server/knowledge-base";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const preferRemote = new URL(req.url).searchParams.get("source") === "remote_knowledge_base";
  ensureSeed();
  const db = getDB();
  const localRow = db.prepare("SELECT * FROM papers WHERE id = ?").get(id) as any;
  if (localRow && !preferRemote) {
    return NextResponse.json({
      success: true,
      data: { paper_id: id, has_pdf: Boolean(localRow.pdf_url), has_fulltext: false, source: "local_metadata_only", pdf_url: localRow.pdf_url || null, chunks: [] },
    });
  }
  if (shouldUseRemoteKnowledgeBase()) {
    try {
      const paper = await getKnowledgePaper(id);
      // 知识底座当前只提供元数据/PDF URL，不把摘要伪造成全文分块。
      return NextResponse.json({
        success: true,
        data: {
          paper_id: paper.paperId,
          has_pdf: Boolean(paper.pdfUrl),
          has_fulltext: false,
          source: "remote_metadata_only",
          pdf_url: paper.pdfUrl ?? null,
          chunks: [],
        },
      });
    } catch (error) {
      if (!shouldFallbackToLocal()) {
        return fail(error instanceof Error ? error.message : "知识底座暂不可用", 502);
      }
      recordKnowledgeFallback();
    }
  }

  if (localRow) {
    return NextResponse.json({
      success: true,
      data: { paper_id: id, has_pdf: Boolean(localRow.pdf_url), has_fulltext: false, source: "local_metadata_only", pdf_url: localRow.pdf_url || null, chunks: [] },
    });
  }
  return fail("论文未找到", 404);
}
