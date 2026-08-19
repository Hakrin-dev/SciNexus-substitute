/**
 * PUT /api/notifications/[id]/read
 * 标记通知为已读
 */
import { NextRequest } from "next/server";
import { ensureSeed, fail, ok } from "@/lib/server/utils";
import { getDB } from "@/lib/server/db";
import { requireAuth } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  ensureSeed();
  const { id } = await params;
  try {
    const user = requireAuth(req);
    if (!user) return fail("请先登录", 401, "UNAUTHORIZED");
    const userId = user.id;
    const db = getDB();
    const r = db
      .prepare("UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?")
      .run(id, userId);
    if (r.changes === 0) return fail("通知不存在", 404);
    return ok({ read: true });
  } catch (e: any) {
    return fail(e.message || "标记失败");
  }
}
