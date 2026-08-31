/**
 * PUT    /api/notes/[id] - 编辑笔记  Body: { title?, content?, tags?, paper_id? }
 * DELETE /api/notes/[id] - 删除笔记
 */
import { NextRequest } from "next/server";
import { ensureSeed, fail, ok, parseBody } from "@/lib/server/utils";
import { getDB, jsonParse } from "@/lib/server/db";
import { requireAuth } from "@/lib/server/auth";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

function mapRow(r: any) {
  return {
    id: r.id,
    title: r.title ?? "",
    content: r.content ?? "",
    tags: jsonParse<string[]>(r.tags_json, []),
    ...(r.paper_id ? { paperId: r.paper_id } : {}),
    ...(r.paper_title ? { paperTitle: r.paper_title } : {}),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  ensureSeed();
  try {
    const user = requireAuth(req);
    if (!user) return fail("请先登录", 401, "UNAUTHORIZED");
    const { id } = await params;

    const body = await parseBody<{
      title?: string;
      content?: string;
      tags?: string[];
      paper_id?: string | null;
    }>(req);

    const db = getDB();
    const existing = db
      .prepare("SELECT * FROM notes WHERE id = ? AND user_id = ?")
      .get(id, user.id) as any;
    if (!existing) return fail("笔记未找到", 404);

    const title = body.title !== undefined ? String(body.title).trim() : existing.title;
    const content = body.content !== undefined ? String(body.content).trim() : existing.content;
    if (!title && !content) return fail("标题和内容至少填一项");
    const tagsJson =
      body.tags !== undefined
        ? JSON.stringify(
            Array.from(new Set(body.tags.map((t) => String(t).trim()).filter(Boolean))).slice(0, 10)
          )
        : existing.tags_json;
    const paperId =
      body.paper_id !== undefined ? body.paper_id || null : existing.paper_id;

    db.prepare(
      `UPDATE notes SET title = ?, content = ?, tags_json = ?, paper_id = ?,
       updated_at = datetime('now', 'localtime') WHERE id = ? AND user_id = ?`
    ).run(title, content, tagsJson, paperId, id, user.id);

    const row = db
      .prepare(
        "SELECT n.*, p.title AS paper_title FROM notes n LEFT JOIN papers p ON p.id = n.paper_id WHERE n.id = ?"
      )
      .get(id) as any;
    return ok(mapRow(row));
  } catch (e: any) {
    return fail(e.message || "编辑笔记失败");
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  ensureSeed();
  try {
    const user = requireAuth(req);
    if (!user) return fail("请先登录", 401, "UNAUTHORIZED");
    const { id } = await params;

    const db = getDB();
    const info = db
      .prepare("DELETE FROM notes WHERE id = ? AND user_id = ?")
      .run(id, user.id);
    if (info.changes === 0) return fail("笔记未找到", 404);

    return ok({ id });
  } catch (e: any) {
    return fail(e.message || "删除笔记失败");
  }
}