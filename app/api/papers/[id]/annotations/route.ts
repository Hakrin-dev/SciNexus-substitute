/**
 * GET  /api/papers/[id]/annotations - 当前用户在该论文的批注列表
 * POST /api/papers/[id]/annotations - 新增批注  Body: { note, quote?, paragraph_id? }
 */
import { NextRequest } from "next/server";
import { ensureSeed, fail, genId, ok, parseBody } from "@/lib/server/utils";
import { getDB } from "@/lib/server/db";
import { requireAuth } from "@/lib/server/auth";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

function mapRow(r: any) {
  return {
    id: r.id,
    paperId: r.paper_id,
    ...(r.paragraph_id ? { paragraphId: r.paragraph_id } : {}),
    quote: r.quote ?? "",
    note: r.note,
    createdAt: r.created_at,
  };
}

export async function GET(req: NextRequest, { params }: Ctx) {
  ensureSeed();
  try {
    const user = requireAuth(req);
    if (!user) return fail("请先登录", 401, "UNAUTHORIZED");
    const { id } = await params;

    const db = getDB();
    const rows = db
      .prepare(
        "SELECT * FROM paper_annotations WHERE user_id = ? AND paper_id = ? ORDER BY created_at DESC"
      )
      .all(user.id, id) as any[];
    return ok(rows.map(mapRow));
  } catch (e: any) {
    return fail(e.message || "获取批注失败");
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  ensureSeed();
  try {
    const user = requireAuth(req);
    if (!user) return fail("请先登录", 401, "UNAUTHORIZED");
    const { id } = await params;

    const body = await parseBody<{ note?: string; quote?: string; paragraph_id?: string }>(req);
    const note = (body.note || "").trim();
    if (!note) return fail("批注内容不能为空");

    const db = getDB();
    const annId = genId("anno_");
    db.prepare(
      `INSERT INTO paper_annotations (id, user_id, paper_id, paragraph_id, quote, note)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(annId, user.id, id, body.paragraph_id || null, (body.quote || "").trim(), note);

    const row = db.prepare("SELECT * FROM paper_annotations WHERE id = ?").get(annId) as any;
    return ok(mapRow(row));
  } catch (e: any) {
    return fail(e.message || "新增批注失败");
  }
}