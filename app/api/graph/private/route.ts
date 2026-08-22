/**
 * GET /api/graph/private
 * 获取私域知识图谱数据（用户自己的发表 + 收藏文献 分层）
 */
import { NextRequest } from "next/server";
import { ensureSeed, fail, ok } from "@/lib/server/utils";
import { getDB, mapGraphNode } from "@/lib/server/db";
import { requireAuth } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  ensureSeed();
  try {
    const user = requireAuth(req);
    if (!user) return fail("请先登录", 401, "UNAUTHORIZED");
    const db = getDB();
    const graphType = "private";
    const nodes = db
      .prepare("SELECT * FROM graph_nodes WHERE graph_type = ? ORDER BY layer DESC, weight DESC")
      .all(graphType) as any[];
    const edges = db
      .prepare("SELECT source, target, strength, cross_layer FROM graph_edges WHERE graph_type = ?")
      .all(graphType) as any[];
    const relatedRows = db
      .prepare("SELECT node_id FROM graph_related_ids WHERE graph_type = ? ORDER BY sort_order")
      .all(graphType) as any[];

    const origin = nodes[0];
    const data = {
      origin: origin ? mapGraphNode(origin) : null,
      nodes: nodes.map(mapGraphNode),
      edges: edges.map((e) => ({
        source: e.source,
        target: e.target,
        strength: e.strength,
        crossLayer: !!e.cross_layer,
      })),
      relatedIds: relatedRows.map((r) => r.node_id),
    };
    return ok(data);
  } catch (e: any) {
    return fail(e.message || "获取私域知识图谱失败");
  }
}
