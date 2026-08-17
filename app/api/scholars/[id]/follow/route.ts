/**
 * POST /api/scholars/[id]/follow  - 关注学者
 * DELETE /api/scholars/[id]/follow - 取消关注
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
    const exists = db.prepare("SELECT 1 FROM scholars WHERE id = ?").get(id);
    if (!exists) return fail("学者不存在", 404);
    db.prepare(
      `INSERT OR IGNORE INTO followed_scholars (user_id, scholar_id) VALUES (?, ?)`
    ).run(userId, id);
    return ok({ followed: true });
  } catch (e: any) {
    return fail(e.message || "关注失败");
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
      `DELETE FROM followed_scholars WHERE user_id = ? AND scholar_id = ?`
    ).run(userId, id);
    return ok({ followed: false });
  } catch (e: any) {
    return fail(e.message || "取消关注失败");
  }
}
