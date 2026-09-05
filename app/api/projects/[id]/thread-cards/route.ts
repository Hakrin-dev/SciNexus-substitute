/**
 * GET  /api/projects/[id]/thread-cards          - 全部线程卡片
 * POST /api/projects/[id]/thread-cards          - 追加线程卡片(用户或 Agent 产出)
 * PATCH/DELETE /api/projects/[id]/thread-cards/[cardId] - 见 [cardId]/route.ts
 */
import { NextRequest } from "next/server";
import { ensureSeed, fail, ok, parseBody, genId } from "@/lib/server/utils";
import { getDB, jsonStringify } from "@/lib/server/db";
import { requireAuth } from "@/lib/server/auth";
import {
  assertProjectOwner,
  CARD_KINDS,
  CARD_STATUSES,
  isOneOf,
  logActivity,
  mapCard,
  nowIso,
} from "@/lib/server/workbench";

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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  ensureSeed();
  const { id } = await params;
  try {
    const user = requireAuth(req);
    if (!user) return fail("请先登录", 401, "UNAUTHORIZED");
    if (!assertProjectOwner(id, user.id)) return fail("项目不存在", 404);

    const body = await parseBody<{
      threadId?: string;
      kind?: string;
      title?: string;
      summary?: string;
      status?: string;
      nodeRef?: string | null;
      aiGenerated?: boolean;
      assetRefs?: string[];
    }>(req);
    if (!body.threadId) return fail("缺少线程 ID");
    if (!body.title || !body.title.trim()) return fail("卡片标题不能为空");
    if (!isOneOf(body.kind, CARD_KINDS)) return fail("卡片类型非法");
    if (body.status !== undefined && !isOneOf(body.status, CARD_STATUSES)) {
      return fail("卡片状态非法");
    }

    const db = getDB();
    const thread = db
      .prepare("SELECT 1 FROM wb_threads WHERE id = ? AND project_id = ?")
      .get(body.threadId, id);
    if (!thread) return fail("所属线程不存在", 404);

    // nodeRef 若提供须为本项目大纲节点(悬空引用显式拒绝)
    let nodeRef: string | null = null;
    if (body.nodeRef) {
      const node = db
        .prepare("SELECT 1 FROM wb_outline_nodes WHERE id = ? AND project_id = ?")
        .get(body.nodeRef, id);
      if (!node) return fail("关联的大纲节点不存在", 404);
      nodeRef = body.nodeRef;
    }

    const cardId = genId("card_");
    db.prepare(
      `INSERT INTO wb_thread_cards
        (id, project_id, thread_id, kind, title, summary, status, node_ref, ai_generated, created_at, asset_refs_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      cardId,
      id,
      body.threadId,
      body.kind,
      body.title.trim(),
      body.summary ?? "",
      body.status ?? "todo",
      nodeRef,
      body.aiGenerated ? 1 : 0,
      nowIso(),
      jsonStringify(body.assetRefs ?? [])
    );

    logActivity(db, {
      projectId: id,
      type: body.aiGenerated ? "task" : "note",
      text: body.aiGenerated
        ? `AI 生成卡片「${body.title.trim()}」。`
        : `新增卡片「${body.title.trim()}」。`,
      threadId: body.threadId,
    });

    const row = db
      .prepare("SELECT * FROM wb_thread_cards WHERE id = ?")
      .get(cardId) as Record<string, unknown>;
    return ok(mapCard(row));
  } catch (e) {
    return fail(e instanceof Error ? e.message : "新增卡片失败");
  }
}
