/**
 * GET /api/papers/[id]/fulltext
 * 论文全文分块（无真实 PDF 时回退摘要分块）
 */
import { NextRequest, NextResponse } from "next/server";
import { ensureSeed, fail } from "@/lib/server/utils";
import { getDB } from "@/lib/server/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  ensureSeed();
  const { id } = await params;
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
