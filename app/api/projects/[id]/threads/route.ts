/**
 * GET /api/projects/[id]/threads - 研究线程列表
 */
import { NextRequest } from "next/server";
import { ensureSeed, fail, ok } from "@/lib/server/utils";
import { getDB } from "@/lib/server/db";
import { requireAuth } from "@/lib/server/auth";
import { assertProjectOwner, mapThread } from "@/lib/server/workbench";

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
      .prepare("SELECT * FROM wb_threads WHERE project_id = ?")
      .all(id) as unknown as Record<string, unknown>[];
    return ok(rows.map(mapThread));
  } catch (e) {
    return fail(e instanceof Error ? e.message : "获取线程失败");
  }
}
