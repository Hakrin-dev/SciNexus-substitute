/**
 * GET /api/projects/[id]/activity - 活动日志(按时间正序,前端自行倒序展示)
 */
import { NextRequest } from "next/server";
import { ensureSeed, fail, ok } from "@/lib/server/utils";
import { getDB } from "@/lib/server/db";
import { requireAuth } from "@/lib/server/auth";
import { assertProjectOwner } from "@/lib/server/workbench";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  ensureSeed();
  const { id } = await params;
  try {
    const user = requireAuth(req);
    if (!user) return fail("请先登录", 401, "UNAUTHORIZED");
    if (!assertProjectOwner(id, user.id)) return fail("项目不存在", 404);

    const rows = getDB()
      .prepare(
        "SELECT * FROM wb_activity_log WHERE project_id = ? ORDER BY created_at ASC"
      )
      .all(id) as unknown as Record<string, unknown>[];
    return ok(
      rows.map((r) => {
        const entry: Record<string, unknown> = {
          id: String(r.id),
          at: String(r.created_at || ""),
          actor: String(r.actor),
          type: String(r.type),
          text: String(r.text || ""),
        };
        if (r.thread_id) entry.threadId = String(r.thread_id);
        return entry;
      })
    );
  } catch (e) {
    return fail(e instanceof Error ? e.message : "获取活动日志失败");
  }
}
