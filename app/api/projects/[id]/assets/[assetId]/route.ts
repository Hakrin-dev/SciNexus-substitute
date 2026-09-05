/**
 * PATCH  /api/projects/[id]/assets/[assetId] - 更新资产(标题/类型/状态/元数据/关联)
 * DELETE /api/projects/[id]/assets/[assetId] - 删除资产(同时清理大纲节点的 assetRefs 悬空引用)
 */
import { NextRequest } from "next/server";
import { ensureSeed, fail, ok, parseBody } from "@/lib/server/utils";
import { getDB, jsonParse, jsonStringify } from "@/lib/server/db";
import { requireAuth } from "@/lib/server/auth";
import {
  assertProjectOwner,
  ASSET_KINDS,
  ASSET_STATUSES,
  isOneOf,
  logActivity,
  mapAsset,
  nowIso,
} from "@/lib/server/workbench";

export const runtime = "nodejs";

type Row = Record<string, unknown>;

/** 校验 questionIds/hypothesisIds 引用的节点属于本项目(悬空引用显式拒绝,与综述管线零幽灵引用原则一致) */
function assertRefsBelongToProject(projectId: string, ids: unknown[]): boolean {
  const strIds = ids.filter((x): x is string => typeof x === "string");
  if (strIds.length === 0) return true;
  const placeholders = strIds.map(() => "?").join(",");
  const n = (
    getDB()
      .prepare(
        `SELECT COUNT(*) AS n FROM wb_outline_nodes WHERE project_id = ? AND id IN (${placeholders})`
      )
      .get(projectId, ...strIds) as { n: number }
  ).n;
  return n === strIds.length;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; assetId: string }> }
) {
  ensureSeed();
  const { id, assetId } = await params;
  try {
    const user = requireAuth(req);
    if (!user) return fail("请先登录", 401, "UNAUTHORIZED");
    if (!assertProjectOwner(id, user.id)) return fail("项目不存在", 404);

    const body = await parseBody<Record<string, unknown>>(req);
    const db = getDB();
    const existing = db
      .prepare("SELECT * FROM wb_assets WHERE id = ? AND project_id = ?")
      .get(assetId, id) as Row | undefined;
    if (!existing) return fail("资产不存在", 404);

    const title =
      body.title === undefined ? String(existing.title ?? "") : String(body.title ?? "").trim();
    if (!title) return fail("资产标题不能为空");
    const kind = body.kind === undefined ? String(existing.kind) : String(body.kind);
    if (!isOneOf(kind, ASSET_KINDS)) return fail("资产类型非法");
    const status = body.status === undefined ? String(existing.status) : String(body.status);
    if (!isOneOf(status, ASSET_STATUSES)) return fail("资产状态非法");
    if (body.questionIds !== undefined && !Array.isArray(body.questionIds)) {
      return fail("questionIds 必须是数组");
    }
    if (body.questionIds !== undefined && !assertRefsBelongToProject(id, body.questionIds)) {
      return fail("引用的问题节点不存在");
    }
    if (body.hypothesisIds !== undefined && !Array.isArray(body.hypothesisIds)) {
      return fail("hypothesisIds 必须是数组");
    }
    if (body.hypothesisIds !== undefined && !assertRefsBelongToProject(id, body.hypothesisIds)) {
      return fail("引用的假设节点不存在");
    }

    const qids =
      body.questionIds === undefined
        ? jsonParse<string[]>(String(existing.question_ids_json || "[]"), [])
        : (body.questionIds as unknown[]).filter((x): x is string => typeof x === "string");
    const hids =
      body.hypothesisIds === undefined
        ? jsonParse<string[]>(String(existing.hypothesis_ids_json || "[]"), [])
        : (body.hypothesisIds as unknown[]).filter((x): x is string => typeof x === "string");
    const tags =
      body.tags === undefined
        ? jsonParse<string[]>(String(existing.tags_json || "[]"), [])
        : (body.tags as unknown[]).filter((x): x is string => typeof x === "string");
    const meta = body.meta === undefined ? String(existing.meta ?? "") : String(body.meta ?? "");
    const updatedAt = nowIso();

    db.prepare(
      `UPDATE wb_assets
       SET kind = ?, title = ?, meta = ?, status = ?, tags_json = ?, question_ids_json = ?, hypothesis_ids_json = ?, updated_at = ?
       WHERE id = ? AND project_id = ?`
    ).run(kind, title, meta, status, jsonStringify(tags), jsonStringify(qids), jsonStringify(hids), updatedAt, assetId, id);

    logActivity(db, {
      projectId: id,
      type: "data",
      text: `更新资产「${title}」。`,
    });

    const row = db
      .prepare("SELECT * FROM wb_assets WHERE id = ?")
      .get(assetId) as Row;
    return ok(mapAsset(row));
  } catch (e) {
    return fail(e instanceof Error ? e.message : "更新资产失败");
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; assetId: string }> }
) {
  ensureSeed();
  const { id, assetId } = await params;
  try {
    const user = requireAuth(req);
    if (!user) return fail("请先登录", 401, "UNAUTHORIZED");
    if (!assertProjectOwner(id, user.id)) return fail("项目不存在", 404);

    const db = getDB();
    const existing = db
      .prepare("SELECT title FROM wb_assets WHERE id = ? AND project_id = ?")
      .get(assetId, id) as { title: string } | undefined;
    if (!existing) return fail("资产不存在", 404);

    db.transaction(() => {
      // 大纲节点 asset_refs_json 中对本资产的引用一并摘除
      const refRows = db
        .prepare(
          "SELECT id, asset_refs_json FROM wb_outline_nodes WHERE project_id = ? AND asset_refs_json LIKE ?"
        )
        .all(id, `%"${assetId}"%`) as Row[];
      const patch = db.prepare(
        "UPDATE wb_outline_nodes SET asset_refs_json = ? WHERE id = ?"
      );
      for (const r of refRows) {
        const refs = jsonParse<string[]>(String(r.asset_refs_json || "[]"), []).filter(
          (x) => x !== assetId
        );
        patch.run(jsonStringify(refs), r.id);
      }
      db.prepare("DELETE FROM wb_assets WHERE id = ? AND project_id = ?").run(assetId, id);
      logActivity(db, {
        projectId: id,
        type: "data",
        text: `删除资产「${String(existing.title)}」。`,
      });
    })();

    return ok({ deleted: true });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "删除资产失败");
  }
}
