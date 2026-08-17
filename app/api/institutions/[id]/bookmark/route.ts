/**
 * POST /api/institutions/[id]/bookmark  - 收藏机构
 * DELETE /api/institutions/[id]/bookmark - 取消收藏
 */
import { NextRequest } from "next/server";
import { ensureSeed, fail, ok } from "@/lib/server/utils";
import { getDB } from "@/lib/server/db";
import { requireAuth } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  ensureSeed();
  const { id } = await params;
  try {
    const user = requireAuth(req);
    if (!user) return fail("请先登录", 401, "UNAUTHORIZED");
    const userId = user.id;
    const db = getDB();
    const exists = db.prepare("SELECT 1 FROM institutions WHERE id = ?").get(id);
    if (!exists) return fail("机构不存在", 404);
    db.prepare(
      `INSERT OR IGNORE INTO bookmarked_institutions (user_id, institution_id) VALUES (?, ?)`
    ).run(userId, id);
    return ok({ bookmarked: true });
  } catch (e: any) {
    return fail(e.message || "收藏失败");
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  ensureSeed();
  const { id } = await params;
  try {
    const user = requireAuth(req);
    if (!user) return fail("请先登录", 401, "UNAUTHORIZED");
    const userId = user.id;
    const db = getDB();
    db.prepare(
      `DELETE FROM bookmarked_institutions WHERE user_id = ? AND institution_id = ?`
    ).run(userId, id);
    return ok({ bookmarked: false });
  } catch (e: any) {
    return fail(e.message || "取消收藏失败");
  }
}
