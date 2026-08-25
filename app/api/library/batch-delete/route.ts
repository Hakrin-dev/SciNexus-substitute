/**
 * POST /api/library/batch-delete - 批量删除文献库条目
 * Body: { ids: string[] }（recordId 列表）
 *
 * 注：批量写操作用 POST 而非带 body 的 DELETE——部分代理/CDN 会剥离 DELETE body。
 */
import { NextRequest } from "next/server";
import { ensureSeed, fail, ok, parseBody } from "@/lib/server/utils";
import { getDB } from "@/lib/server/db";
import { requireAuth } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  ensureSeed();
  try {
    const user = requireAuth(req);
    if (!user) return fail("请先登录", 401, "UNAUTHORIZED");
    const userId = user.id;
    const body = await parseBody<{ ids: string[] }>(req);
    if (!body.ids?.length) return fail("请选择要删除的条目");
    const db = getDB();
    const stmt = db.prepare(
      "DELETE FROM library_items WHERE id = ? AND user_id = ?"
    );
    let removed = 0;
    const tx = db.transaction(() => {
      for (const id of body.ids) {
        const r = stmt.run(id, userId);
        removed += r.changes;
      }
    });
    tx();
    return ok({ removed, message: `已删除 ${removed} 篇文献` });
  } catch (e: any) {
    return fail(e.message || "删除失败");
  }
}
