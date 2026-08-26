/**
 * GET    /api/projects/[id]/thread-cards          - 全部线程卡片
 * PATCH  /api/projects/[id]/thread-cards/[cardId] - 卡片状态流转(见 [cardId]/route.ts)
 */
import { NextRequest } from "next/server";
import { ensureSeed, fail, ok } from "@/lib/server/utils";
import { getDB } from "@/lib/server/db";
import { requireAuth } from "@/lib/server/auth";
import { assertProjectOwner, mapCard } from "@/lib/server/workbench";

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
        "SELECT * FROM wb_thread_cards WHERE project_id = ? ORDER BY created_at ASC"
      )
      .all(id) as unknown as Record<string, unknown>[];
    return ok(rows.map(mapCard));
  } catch (e) {
    return fail(e instanceof Error ? e.message : "获取卡片失败");
  }
}
