/**
 * DELETE /api/annotations/[id] - 删除批注（仅本人）
 */
import { NextRequest } from "next/server";
import { ensureSeed, fail, ok } from "@/lib/server/utils";
import { getDB } from "@/lib/server/db";
import { requireAuth } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  ensureSeed();
  try {
    const user = requireAuth(req);
    if (!user) return fail("请先登录", 401, "UNAUTHORIZED");
    const { id } = await params;

    const db = getDB();
    const info = db
      .prepare("DELETE FROM paper_annotations WHERE id = ? AND user_id = ?")
      .run(id, user.id);
    if (info.changes === 0) return fail("批注未找到", 404);

    return ok({ id });
  } catch (e: any) {
    return fail(e.message || "删除批注失败");
  }
}