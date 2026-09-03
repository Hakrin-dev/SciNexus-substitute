/**
 * PATCH /api/projects/[id]/thread-cards/[cardId]
 * 卡片状态流转(todo → doing → done),成功后写入一条活动日志。
 * Body: { status: "todo" | "doing" | "done" }
 */
import { NextRequest } from "next/server";
import { ensureSeed, fail, ok, parseBody } from "@/lib/server/utils";
import { getDB } from "@/lib/server/db";
import { requireAuth } from "@/lib/server/auth";
import { canAccessProject, mapCard, writeAudit } from "@/lib/server/workbench";
import { genId } from "@/lib/server/utils";

export const runtime = "nodejs";

const VALID_STATUS = new Set(["todo", "doing", "done"]);

type Row = Record<string, unknown>;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; cardId: string }> }
) {
  ensureSeed();
  const { id, cardId } = await params;
  try {
    const user = requireAuth(req);
    if (!user) return fail("请先登录", 401, "UNAUTHORIZED");
    if (!canAccessProject(id, user.id, "write")) return fail("没有项目编辑权限", 403, "FORBIDDEN");

    const body = await parseBody<{ status?: string }>(req);
    if (!body.status || !VALID_STATUS.has(body.status)) {
      return fail("状态必须是 todo / doing / done");
    }

    const db = getDB();
    const card = db
      .prepare("SELECT * FROM wb_thread_cards WHERE id = ? AND project_id = ?")
      .get(cardId, id) as Row | undefined;
    if (!card) return fail("卡片不存在", 404);

    db.prepare(
      "UPDATE wb_thread_cards SET status = ? WHERE id = ? AND project_id = ?"
    ).run(body.status, cardId, id);

    // 状态流转写入活动日志,让日志视图保持鲜活
    const statusText: Record<string, string> = {
      todo: "待办",
      doing: "进行中",
      done: "已完成",
    };
    db.prepare(
      `INSERT INTO wb_activity_log (id, project_id, actor, type, text, thread_id, created_at)
       VALUES (?, ?, 'user', 'task', ?, ?, datetime('now', 'localtime'))`
    ).run(
      genId("log_"),
      id,
      `更新卡片「${String(card.title)}」状态为${statusText[body.status]}。`,
      card.thread_id ? String(card.thread_id) : null
    );

    const updated = db
      .prepare("SELECT * FROM wb_thread_cards WHERE id = ?")
      .get(cardId) as Row;
    writeAudit({ userId: user.id, projectId: id, action: "thread_card.update", resourceType: "thread_card", resourceId: cardId, metadata: { status: body.status } });
    return ok({ card: mapCard(updated) });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "更新卡片失败");
  }
}
