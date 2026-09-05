/**
 * GET  /api/projects/[id]/assets - 工作台资产列表
 * POST /api/projects/[id]/assets - 新增资产
 */
import { NextRequest } from "next/server";
import { ensureSeed, fail, ok, parseBody, genId } from "@/lib/server/utils";
import { getDB, jsonStringify } from "@/lib/server/db";
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
        "SELECT * FROM wb_assets WHERE project_id = ? ORDER BY updated_at DESC"
      )
      .all(id) as unknown as Record<string, unknown>[];
    return ok(rows.map(mapAsset));
  } catch (e) {
    return fail(e instanceof Error ? e.message : "获取资产失败");
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
      kind?: string;
      title?: string;
      meta?: string;
      status?: string;
      questionIds?: string[];
      hypothesisIds?: string[];
      tags?: string[];
    }>(req);
    if (!body.title || !body.title.trim()) return fail("资产标题不能为空");
    if (!isOneOf(body.kind, ASSET_KINDS)) return fail("资产类型非法");
    if (body.status !== undefined && !isOneOf(body.status, ASSET_STATUSES)) {
      return fail("资产状态非法");
    }
    // questionIds/hypothesisIds 若提供,须指向本项目大纲中真实存在的节点
    const ids = [...(body.questionIds ?? []), ...(body.hypothesisIds ?? [])];
    if (ids.length) {
      const placeholders = ids.map(() => "?").join(",");
      const n = (
        getDB()
          .prepare(
            `SELECT COUNT(*) AS n FROM wb_outline_nodes WHERE project_id = ? AND id IN (${placeholders})`
          )
          .get(id, ...ids) as { n: number }
      ).n;
      if (n !== ids.length) return fail("引用的大纲节点不存在");
    }

    const assetId = genId("asset_");
    const now = nowIso();
    getDB()
      .prepare(
        `INSERT INTO wb_assets
          (id, project_id, kind, title, meta, status, tags_json, question_ids_json, hypothesis_ids_json, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        assetId,
        id,
        body.kind,
        body.title.trim(),
        body.meta ?? "",
        body.status ?? "unread",
        jsonStringify(body.tags ?? []),
        jsonStringify(body.questionIds ?? []),
        jsonStringify(body.hypothesisIds ?? []),
        now
      );

    logActivity(getDB(), {
      projectId: id,
      type: "data",
      text: `新增资产「${body.title.trim()}」。`,
    });

    const row = getDB()
      .prepare("SELECT * FROM wb_assets WHERE id = ?")
      .get(assetId) as Record<string, unknown>;
    return ok(mapAsset(row));
  } catch (e) {
    return fail(e instanceof Error ? e.message : "新增资产失败");
  }
}
