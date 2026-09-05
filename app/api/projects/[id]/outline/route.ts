/**
 * GET  /api/projects/[id]/outline - 研究大纲树(parent_id 平表 → 嵌套树)
 * POST /api/projects/[id]/outline - 新增大纲节点(根节点或挂到指定父节点下)
 */
import { NextRequest } from "next/server";
import { ensureSeed, fail, ok, parseBody, genId } from "@/lib/server/utils";
import { getDB, jsonStringify } from "@/lib/server/db";
import { requireAuth } from "@/lib/server/auth";
import {
  assertProjectOwner,
  buildOutlineTree,
  getOutlineRows,
  isOneOf,
  logActivity,
  mapNode,
  OUTLINE_KINDS,
  NODE_STATUSES,
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

    const rows = getOutlineRows(getDB(), id);
    return ok(buildOutlineTree(rows));
  } catch (e) {
    return fail(e instanceof Error ? e.message : "获取大纲失败");
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
      parentId?: string | null;
      kind?: string;
      title?: string;
      status?: string;
      detail?: string;
      aiNote?: string;
      assetRefs?: string[];
      sort?: number;
    }>(req);
    if (!body.title || !body.title.trim()) return fail("节点标题不能为空");
    if (!isOneOf(body.kind, OUTLINE_KINDS)) return fail("节点类型非法");
    if (body.status !== undefined && !isOneOf(body.status, NODE_STATUSES)) {
      return fail("节点状态非法");
    }

    const db = getDB();
    // 父节点须属于同一项目(防跨项目弱引用)
    let parentId: string | null = null;
    if (body.parentId) {
      const parent = db
        .prepare("SELECT 1 FROM wb_outline_nodes WHERE id = ? AND project_id = ?")
        .get(body.parentId, id);
      if (!parent) return fail("父节点不存在", 404);
      parentId = body.parentId;
    }

    const nodeId = genId("node_");
    // 同级内 sort 缺省取 max+1(SQLite 的 IS 支持 NULL 比较)
    const maxRow = db
      .prepare(
        `SELECT COALESCE(MAX(sort), -1) AS m FROM wb_outline_nodes
         WHERE project_id = ? AND parent_id IS ?`
      )
      .get(id, parentId) as { m: number };
    const sort = body.sort ?? maxRow.m + 1;

    db.prepare(
      `INSERT INTO wb_outline_nodes
        (id, project_id, parent_id, kind, title, status, detail, ai_note, sort, asset_refs_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      nodeId,
      id,
      parentId,
      body.kind,
      body.title.trim(),
      body.status ?? "open",
      body.detail ?? null,
      body.aiNote ?? null,
      sort,
      jsonStringify(body.assetRefs ?? [])
    );

    logActivity(db, {
      projectId: id,
      type: "task",
      text: `新增大纲节点「${body.title.trim()}」。`,
    });

    const row = db
      .prepare("SELECT * FROM wb_outline_nodes WHERE id = ?")
      .get(nodeId) as Record<string, unknown>;
    return ok(mapNode(row));
  } catch (e) {
    return fail(e instanceof Error ? e.message : "新增大纲节点失败");
  }
}
