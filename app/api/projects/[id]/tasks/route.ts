/**
 * GET /api/projects/[id]/tasks - Agent 任务状态栏
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
      .prepare("SELECT * FROM wb_agent_tasks WHERE project_id = ? ORDER BY id")
      .all(id) as unknown as Record<string, unknown>[];
    return ok(
      rows.map((r) => ({
        id: String(r.id),
        agent: String(r.agent),
        label: String(r.label || ""),
        state: String(r.state),
      }))
    );
  } catch (e) {
    return fail(e instanceof Error ? e.message : "获取任务失败");
  }
}
