/**
 * GET /api/conversations - 对话历史列表
 */
import { NextRequest } from "next/server";
import { ensureSeed, fail, ok } from "@/lib/server/utils";
import { getDB } from "@/lib/server/db";
import { requireAuth } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  ensureSeed();
  try {
    const user = requireAuth(req);
    if (!user) return fail("请先登录", 401, "UNAUTHORIZED");
    const userId = user.id;
    const db = getDB();
    const rows = db
      .prepare(
        "SELECT id, title, preview, updated_at FROM conversations WHERE user_id = ? ORDER BY updated_at DESC"
      )
      .all(userId) as any[];
    return ok(
      rows.map((r) => ({
        id: r.id,
        title: r.title,
        preview: r.preview,
        updatedAt: r.updated_at,
      }))
    );
  } catch (e: any) {
    return fail(e.message || "获取对话列表失败");
  }
}
