/**
 * DELETE /api/projects/[id]/threads/[threadId] - 删除研究线程(级联删除其全部卡片)
 */
import { NextRequest } from "next/server";
import { ensureSeed, fail, ok } from "@/lib/server/utils";
import { getDB } from "@/lib/server/db";
import { requireAuth } from "@/lib/server/auth";
import { assertProjectOwner, logActivity } from "@/lib/server/workbench";

export const runtime = "nodejs";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; threadId: string }> }
) {
  ensureSeed();
  const { id, threadId } = await params;
  try {
    const user = requireAuth(req);
    if (!user) return fail("请先登录", 401, "UNAUTHORIZED");
    if (!assertProjectOwner(id, user.id)) return fail("项目不存在", 404);

    const db = getDB();
    const existing = db
      .prepare("SELECT title FROM wb_threads WHERE id = ? AND project_id = ?")
      .get(threadId, id) as { title: string } | undefined;
    if (!existing) return fail("线程不存在", 404);

    db.transaction(() => {
      db.prepare("DELETE FROM wb_thread_cards WHERE thread_id = ? AND project_id = ?").run(
        threadId,
        id
      );
      db.prepare("DELETE FROM wb_threads WHERE id = ? AND project_id = ?").run(threadId, id);
      logActivity(db, {
        projectId: id,
        type: "task",
        text: `删除研究线程「${String(existing.title)}」。`,
      });
    })();

    return ok({ deleted: true });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "删除线程失败");
  }
}
