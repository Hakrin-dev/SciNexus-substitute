/**
 * GET /api/notifications - 通知列表
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
        "SELECT * FROM notifications WHERE user_id = ? ORDER BY read ASC, time DESC"
      )
      .all(userId) as any[];
    const data = rows.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      desc: r.desc,
      time: r.time,
      read: !!r.read,
      icon: r.icon,
    }));
    return ok({
      items: data,
      unread_count: data.filter((d) => !d.read).length,
    });
  } catch (e: any) {
    return fail(e.message || "获取通知失败");
  }
}
