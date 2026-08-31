/**
 * PUT    /api/memory/entries/[id] - 编辑记忆条目 fact
 * DELETE /api/memory/entries/[id] - 删除记忆条目
 */
import { NextRequest } from "next/server";
import { ensureSeed, fail, ok, parseBody } from "@/lib/server/utils";
import { getDB, mapMemoryEntry } from "@/lib/server/db";
import { requireAuth } from "@/lib/server/auth";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  ensureSeed();
  try {
    const user = requireAuth(req);
    if (!user) return fail("请先登录", 401, "UNAUTHORIZED");
    const { id } = await params;

    const body = await parseBody<{ fact?: string }>(req);
    const fact = (body.fact || "").trim();
    if (!fact) return fail("fact 不能为空");

    const db = getDB();
    const info = db
      .prepare("UPDATE memory_entries SET fact = ? WHERE id = ? AND user_id = ?")
      .run(fact, id, user.id);
    if (info.changes === 0) return fail("记忆条目未找到", 404);

    const row = db.prepare("SELECT * FROM memory_entries WHERE id = ?").get(id) as any;
    return ok(mapMemoryEntry(row));
  } catch (e: any) {
    return fail(e.message || "编辑记忆失败");
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
      .prepare("DELETE FROM memory_entries WHERE id = ? AND user_id = ?")
      .run(id, user.id);
    if (info.changes === 0) return fail("记忆条目未找到", 404);

    return ok({ id });
  } catch (e: any) {
    return fail(e.message || "删除记忆失败");
  }
}