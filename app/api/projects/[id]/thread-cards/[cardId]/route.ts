/**
 * PATCH  /api/projects/[id]/thread-cards/[cardId] - 卡片状态流转(todo → doing → done)
 * DELETE /api/projects/[id]/thread-cards/[cardId] - 删除线程卡片
 * 写操作均会追加一条活动日志。
 */
import { NextRequest } from "next/server";
import { ensureSeed, fail, ok, parseBody } from "@/lib/server/utils";
import { getDB } from "@/lib/server/db";
import { requireAuth } from "@/lib/server/auth";
import {
  assertProjectOwner,
  CARD_STATUSES,
  isOneOf,
  logActivity,
  mapCard,
} from "@/lib/server/workbench";

export const runtime = "nodejs";

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
    if (!assertProjectOwner(id, user.id)) return fail("项目不存在", 404);

    const body = await parseBody<{ status?: string }>(req);
    if (!isOneOf(body.status, CARD_STATUSES)) {
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
    logActivity(db, {
      projectId: id,
      type: "task",
      text: `更新卡片「${String(card.title)}」状态为${statusText[body.status]}。`,
      threadId: card.thread_id ? String(card.thread_id) : null,
    });

    const updated = db
      .prepare("SELECT * FROM wb_thread_cards WHERE id = ?")
      .get(cardId) as Row;
    return ok({ card: mapCard(updated) });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "更新卡片失败");
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; cardId: string }> }
) {
  ensureSeed();
  const { id, cardId } = await params;
  try {
    const user = requireAuth(req);
    if (!user) return fail("请先登录", 401, "UNAUTHORIZED");
    if (!assertProjectOwner(id, user.id)) return fail("项目不存在", 404);

    const db = getDB();
    const card = db
      .prepare("SELECT title, thread_id FROM wb_thread_cards WHERE id = ? AND project_id = ?")
      .get(cardId, id) as { title: string; thread_id: string | null } | undefined;
    if (!card) return fail("卡片不存在", 404);

    db.prepare("DELETE FROM wb_thread_cards WHERE id = ? AND project_id = ?").run(cardId, id);
    logActivity(db, {
      projectId: id,
      type: "task",
      text: `删除卡片「${String(card.title)}」。`,
      threadId: card.thread_id,
    });

    return ok({ deleted: true });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "删除卡片失败");
  }
}
