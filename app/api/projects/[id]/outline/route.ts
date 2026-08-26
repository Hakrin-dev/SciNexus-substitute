/**
 * GET /api/projects/[id]/outline - 研究大纲树(parent_id 平表 → 嵌套树)
 */
import { NextRequest } from "next/server";
import { ensureSeed, fail, ok } from "@/lib/server/utils";
import { getDB, jsonParse } from "@/lib/server/db";
import { requireAuth } from "@/lib/server/auth";
import { assertProjectOwner } from "@/lib/server/workbench";

export const runtime = "nodejs";

interface DbNode {
  id: string;
  parent_id: string | null;
  kind: string;
  title: string;
  status: string;
  detail: string | null;
  ai_note: string | null;
  asset_refs_json: string;
}

function buildTree(rows: DbNode[]): unknown[] {
  const byId = new Map<string, ReturnType<typeof mapNode>>();
  const roots: ReturnType<typeof mapNode>[] = [];
  for (const r of rows) byId.set(r.id, mapNode(r));
  for (const r of rows) {
    const node = byId.get(r.id)!;
    if (r.parent_id && byId.has(r.parent_id)) {
      byId.get(r.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;

  function mapNode(r: DbNode) {
    const node: Record<string, unknown> = {
      id: r.id,
      kind: r.kind,
      title: r.title,
      status: r.status,
      assetRefs: jsonParse<string[]>(r.asset_refs_json || "[]", []),
      children: [],
    };
    if (r.detail) node.detail = r.detail;
    if (r.ai_note) node.aiNote = r.ai_note;
    return node as { children: unknown[] };
  }
}

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
        `SELECT id, parent_id, kind, title, status, detail, ai_note, asset_refs_json
         FROM wb_outline_nodes WHERE project_id = ? ORDER BY sort, id`
      )
      .all(id) as unknown as DbNode[];
    return ok(buildTree(rows));
  } catch (e) {
    return fail(e instanceof Error ? e.message : "获取大纲失败");
  }
}
