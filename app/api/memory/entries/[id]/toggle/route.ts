/**
 * POST /api/memory/entries/[id]/toggle - 启用 / 停用单条记忆
 */
import { NextRequest } from "next/server";
import { ensureSeed, fail, ok } from "@/lib/server/utils";
import { getDB, mapMemoryEntry } from "@/lib/server/db";
import { requireAuth } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  ensureSeed();
  try {
    const user = requireAuth(req);
    if (!user) return fail("请先登录", 401, "UNAUTHORIZED");
    const { id } = await params;

    const db = getDB();
    const existing = db
      .prepare("SELECT enabled FROM memory_entries WHERE id = ? AND user_id = ?")
      .get(id, user.id) as { enabled?: number } | undefined;
    if (!existing) return fail("记忆条目未找到", 404);

    const next = existing.enabled ? 0 : 1;
    db
      .prepare("UPDATE memory_entries SET enabled = ? WHERE id = ? AND user_id = ?")
      .run(next, id, user.id);

    const row = db.prepare("SELECT * FROM memory_entries WHERE id = ?").get(id) as any;
    return ok(mapMemoryEntry(row));
  } catch (e: any) {
    return fail(e.message || "切换记忆状态失败");
  }
}