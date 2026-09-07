/**
 * GET  /api/projects/[id]/assets - 工作台资产列表
 * POST /api/projects/[id]/assets - 新增资产
 */
import { NextRequest } from "next/server";
import { ensureSeed, fail, ok, parseBody, genId } from "@/lib/server/utils";
import { getDB, jsonStringify } from "@/lib/server/db";
import { getCurrentUser, requireAuth } from "@/lib/server/auth";
import {
  canAccessProject,
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
    const user = getCurrentUser(req);
    if (!canAccessProject(id, user?.id, "read")) return fail("项目不存在", 404);

    const rows = getDB()
      .prepare(
        `SELECT a.*,r.run_id artifact_run_id,r.stage artifact_stage,r.kind artifact_kind,r.uri artifact_uri,r.content artifact_content,r.metadata_json artifact_metadata_json
         FROM wb_assets a LEFT JOIN research_artifacts r ON r.id=a.id AND r.project_id=a.project_id WHERE a.project_id=? ORDER BY a.updated_at DESC`
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
    if (!canAccessProject(id, user.id, "write")) return fail("没有新增资产权限", 403, "FORBIDDEN");

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
    if (body.title.trim().length > 200) return fail("资产标题不能超过 200 字", 422);
    if (!isOneOf(body.kind, ASSET_KINDS)) return fail("资产类型非法");
    if (body.status !== undefined && !isOneOf(body.status, ASSET_STATUSES)) {
      return fail("资产状态非法");
    }
    if (body.meta && body.meta.length > 1000) return fail("资产说明不能超过 1000 字", 422);
    if (body.questionIds !== undefined && !Array.isArray(body.questionIds)) return fail("questionIds 必须是数组", 422);
    if (body.hypothesisIds !== undefined && !Array.isArray(body.hypothesisIds)) return fail("hypothesisIds 必须是数组", 422);
    if (body.tags !== undefined && !Array.isArray(body.tags)) return fail("tags 必须是数组", 422);
    const questionIds = [...new Set((body.questionIds ?? []).filter((value): value is string => typeof value === "string"))];
    const hypothesisIds = [...new Set((body.hypothesisIds ?? []).filter((value): value is string => typeof value === "string"))];
    const tags = [...new Set((body.tags ?? []).filter((value): value is string => typeof value === "string").map((value) => value.trim()).filter(Boolean))].slice(0, 20);
    for (const [nodeIds, kind] of [[questionIds, "question"], [hypothesisIds, "hypothesis"]] as const) {
      if (!nodeIds.length) continue;
      const placeholders = nodeIds.map(() => "?").join(",");
      const count = (getDB().prepare(
        `SELECT COUNT(*) AS n FROM wb_outline_nodes WHERE project_id = ? AND kind = ? AND id IN (${placeholders})`,
      ).get(id, kind, ...nodeIds) as { n: number }).n;
      if (count !== nodeIds.length) return fail(`引用的${kind === "question" ? "研究问题" : "假设"}不存在`, 422);
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
        jsonStringify(tags),
        jsonStringify(questionIds),
        jsonStringify(hypothesisIds),
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
