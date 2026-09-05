/**
 * PATCH  /api/projects/[id]/outline/[nodeId] - 更新大纲节点(标题/类型/状态/详情/排序/移动父级)
 * DELETE /api/projects/[id]/outline/[nodeId] - 删除大纲节点(整棵子树级联)
 */
import { NextRequest } from "next/server";
import { ensureSeed, fail, ok, parseBody } from "@/lib/server/utils";
import { getDB, jsonParse, jsonStringify } from "@/lib/server/db";
import { requireAuth } from "@/lib/server/auth";
import {
  assertProjectOwner,
  collectSubtreeIds,
  getOutlineRows,
  isOneOf,
  logActivity,
  mapNode,
  OUTLINE_KINDS,
  NODE_STATUSES,
} from "@/lib/server/workbench";

export const runtime = "nodejs";

type Row = Record<string, unknown>;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; nodeId: string }> }
) {
  ensureSeed();
  const { id, nodeId } = await params;
  try {
    const user = requireAuth(req);
    if (!user) return fail("请先登录", 401, "UNAUTHORIZED");
    if (!assertProjectOwner(id, user.id)) return fail("项目不存在", 404);

    const body = await parseBody<Record<string, unknown>>(req);
    const db = getDB();
    const existing = db
      .prepare("SELECT * FROM wb_outline_nodes WHERE id = ? AND project_id = ?")
      .get(nodeId, id) as Row | undefined;
    if (!existing) return fail("节点不存在", 404);

    const title = body.title === undefined ? String(existing.title ?? "") : String(body.title ?? "").trim();
    if (!title) return fail("节点标题不能为空");
    const kind = body.kind === undefined ? String(existing.kind) : String(body.kind);
    if (!isOneOf(kind, OUTLINE_KINDS)) return fail("节点类型非法");
    const status = body.status === undefined ? String(existing.status) : String(body.status);
    if (!isOneOf(status, NODE_STATUSES)) return fail("节点状态非法");

    // 父级调整:支持移根(null)或挂到另一节点;目标须存在且不得为自身/后代(防环)
    let parentId: string | null = existing.parent_id ? String(existing.parent_id) : null;
    if (body.parentId !== undefined) {
      const want = body.parentId === null ? null : String(body.parentId);
      if (want !== null) {
        if (want === nodeId) return fail("不能将节点挂到自身");
        const target = db
          .prepare("SELECT 1 FROM wb_outline_nodes WHERE id = ? AND project_id = ?")
          .get(want, id);
        if (!target) return fail("目标父节点不存在", 404);
        const rows = getOutlineRows(db, id);
        const sub = collectSubtreeIds(rows, nodeId);
        if (sub.has(want)) return fail("不能移动到自己的后代节点下");
      }
      parentId = want;
    }

    const detail = body.detail === undefined ? existing.detail : body.detail === null ? null : String(body.detail);
    const aiNote = body.aiNote === undefined ? existing.ai_note : body.aiNote === null ? null : String(body.aiNote);
    let assetRefs = existing.asset_refs_json ? jsonParse<string[]>(String(existing.asset_refs_json), []) : [];
    if (body.assetRefs !== undefined) {
      assetRefs = Array.isArray(body.assetRefs)
        ? (body.assetRefs as unknown[]).filter((x): x is string => typeof x === "string")
        : [];
    }
    const sort = body.sort === undefined ? existing.sort : Math.max(0, Math.floor(Number(body.sort) || 0));

    db.prepare(
      `UPDATE wb_outline_nodes
       SET parent_id = ?, kind = ?, title = ?, status = ?, detail = ?, ai_note = ?, sort = ?, asset_refs_json = ?
       WHERE id = ? AND project_id = ?`
    ).run(parentId, kind, title, status, detail, aiNote, sort, jsonStringify(assetRefs), nodeId, id);

    logActivity(db, {
      projectId: id,
      type: "task",
      text: `更新大纲节点「${title}」。`,
    });

    const row = db
      .prepare("SELECT * FROM wb_outline_nodes WHERE id = ?")
      .get(nodeId) as Row;
    return ok(mapNode(row));
  } catch (e) {
    return fail(e instanceof Error ? e.message : "更新大纲节点失败");
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; nodeId: string }> }
) {
  ensureSeed();
  const { id, nodeId } = await params;
  try {
    const user = requireAuth(req);
    if (!user) return fail("请先登录", 401, "UNAUTHORIZED");
    if (!assertProjectOwner(id, user.id)) return fail("项目不存在", 404);

    const db = getDB();
    const existing = db
      .prepare("SELECT title FROM wb_outline_nodes WHERE id = ? AND project_id = ?")
      .get(nodeId, id) as { title: string } | undefined;
    if (!existing) return fail("节点不存在", 404);

    const rows = getOutlineRows(db, id);
    const doomed = collectSubtreeIds(rows, nodeId);
    const placeholders = [...doomed].map(() => "?").join(",");

    db.transaction(() => {
      // 级联清理指向已删节点的弱引用:线程卡片的 node_ref、线程的问题节点
      db.prepare(
        `UPDATE wb_thread_cards SET node_ref = NULL
         WHERE project_id = ? AND node_ref IN (${placeholders})`
      ).run(id, ...doomed);
      db.prepare(
        `UPDATE wb_threads SET question_node_id = NULL
         WHERE project_id = ? AND question_node_id IN (${placeholders})`
      ).run(id, ...doomed);
      db.prepare(
        `DELETE FROM wb_outline_nodes WHERE project_id = ? AND id IN (${placeholders})`
      ).run(id, ...doomed);
      logActivity(db, {
        projectId: id,
        type: "task",
        text: `删除大纲节点「${String(existing.title)}」(含 ${doomed.size} 个子节点)。`,
      });
    })();

    return ok({ deleted: true });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "删除大纲节点失败");
  }
}
