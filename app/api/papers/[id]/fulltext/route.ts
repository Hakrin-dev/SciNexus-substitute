/**
 * GET /api/papers/[id]/fulltext
 * 论文全文分块（无真实 PDF 时回退摘要分块）
 */
import { NextRequest, NextResponse } from "next/server";
import { ensureSeed, fail } from "@/lib/server/utils";
import { getDB } from "@/lib/server/db";
import {
  getKnowledgePaper,
  shouldFallbackToLocal,
  shouldUseRemoteKnowledgeBase,
} from "@/lib/server/knowledge-base";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (shouldUseRemoteKnowledgeBase()) {
    try {
      const paper = await getKnowledgePaper(id);
      // 知识底座当前只提供元数据/PDF URL，不把摘要伪造成全文分块。
      return NextResponse.json({
        success: true,
        data: {
          paper_id: paper.paperId,
          has_pdf: false,
          source: "remote_metadata_only",
          pdf_url: paper.pdfUrl ?? null,
          chunks: [],
        },
      });
    } catch (error) {
      if (!shouldFallbackToLocal()) {
        return fail(error instanceof Error ? error.message : "知识底座暂不可用", 502);
      }
    }
  }

  ensureSeed();
  const db = getDB();
  const row = db.prepare("SELECT * FROM papers WHERE id = ?").get(id) as any;
  if (!row) return fail("论文未找到", 404);

  const abstract = (row.abstract || "").trim();
  const chunks = abstract
    ? [{ chunk_id: `${id}-p1-c1`, page: 1, text: abstract }]
    : [];

  return NextResponse.json({
    success: true,
    data: {
      paper_id: id,
      has_pdf: false,
      source: "abstract_fallback",
      chunks,
    },
  });
}
