/**
 * PUT /api/library/[id]/progress
 * 更新文献阅读进度（并根据进度自动修改状态）
 *
 * Body: { progress: 0-100 }
 */
import { NextRequest } from "next/server";
import { ensureSeed, fail, ok, parseBody } from "@/lib/server/utils";
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
    const body = await parseBody<{ progress: number }>(req);
    const progress = Math.min(100, Math.max(0, Math.round(Number(body.progress) || 0)));
    const status = progress >= 100 ? "read" : progress > 0 ? "reading" : "unread";
    const db = getDB();
    const r = db
      .prepare(
        "UPDATE library_items SET reading_progress = ?, status = ? WHERE id = ? AND user_id = ?"
      )
      .run(progress, status, id, userId);
    if (r.changes === 0) return fail("未找到该文献", 404);
    return ok({ progress, status });
  } catch (e: any) {
    return fail(e.message || "更新进度失败");
  }
}
