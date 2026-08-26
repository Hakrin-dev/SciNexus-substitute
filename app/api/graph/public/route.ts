/**
 * GET /api/graph/public[?paper_id=xxx]
 * 获取公域知识图谱数据。
 * - 传 paper_id 且库内存在该论文时,以该论文为 origin、同 tag/venue 论文为邻域动态构图;
 * - 未传或未命中时回退种子演示图谱(graph_nodes/graph_edges 表)。
 */
import { NextRequest } from "next/server";
import { ensureSeed, fail, ok } from "@/lib/server/utils";
import { getDB, jsonParse, mapGraphNode } from "@/lib/server/db";

export const runtime = "nodejs";

/** papers 表行(构图所需字段子集) */
interface GraphPaperRow {
  id: string;
  title: string;
  authors: string;
  venue: string | null;
  year: number | null;
  citations: number | null;
  abstract: string | null;
  tags_json: string | null;
}

/** 以指定论文为中心动态构建演示级引用图谱 */
function buildGraphAround(db: ReturnType<typeof getDB>, paperId: string) {
  const row = db.prepare("SELECT * FROM papers WHERE id = ?").get(paperId) as GraphPaperRow | undefined;
  if (!row) return null;

  const tags = jsonParse<string[]>(row.tags_json, []);
  const rows = db.prepare("SELECT * FROM papers WHERE id != ?").all(paperId) as unknown as GraphPaperRow[];

  // 相关度 = 共同 tag 数 ×10 + 同 venue ×4,取前 8 篇为邻域
  const scored = rows
    .map((r) => {
      const rTags = jsonParse<string[]>(r.tags_json, []);
      const sharedTags = tags.filter((t) => rTags.includes(t));
      let score = sharedTags.length * 10;
      if (r.venue && r.venue === row.venue) score += 4;
      return { row: r, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || (b.row.citations ?? 0) - (a.row.citations ?? 0))
    .slice(0, 8);

  const toNode = (r: GraphPaperRow, weight: number) => ({
    id: String(r.id),
    labelLines: [String(r.year ?? ""), r.venue ?? "arXiv"],
    weight,
    year: r.year,
    title: r.title,
    authors: r.authors,
    venue: r.venue,
    citations: r.citations,
    abstract: r.abstract,
    paperId: r.id,
    layer: "public",
  });

  // 邻域节点:weight 归一到 0~1(前端 nodeRadius 以此算半径),不含 origin(画布单独渲染)
  const neighborNodes = scored.map((s, i) =>
    toNode(s.row, Math.max(0.18, 0.9 - i * 0.09)),
  );
  const originNode = { ...toNode(row, 1), id: String(row.id) };

  return {
    origin: originNode,
    nodes: neighborNodes,
    edges: neighborNodes.map((n) => ({
      source: originNode.id,
      target: n.id,
      strength: 0.6,
      crossLayer: false,
    })),
    relatedIds: neighborNodes.map((n) => n.paperId),
  };
}

export async function GET(req: NextRequest) {
  ensureSeed();
  try {
    const db = getDB();
    const paperId = new URL(req.url).searchParams.get("paper_id");

    if (paperId) {
      const built = buildGraphAround(db, paperId);
      if (built) return ok(built);
      // 未命中论文则继续走下方演示图谱兜底
    }

    const graphType = "public";
    const nodes = db
      .prepare("SELECT * FROM graph_nodes WHERE graph_type = ? ORDER BY weight DESC")
      .all(graphType) as Array<Record<string, unknown>>;
    const edges = db
      .prepare("SELECT source, target, strength, cross_layer FROM graph_edges WHERE graph_type = ?")
      .all(graphType) as Array<Record<string, unknown>>;
    const relatedRows = db
      .prepare("SELECT node_id FROM graph_related_ids WHERE graph_type = ? ORDER BY sort_order")
      .all(graphType) as Array<{ node_id: string }>;

    const origin = nodes[0];
    const data = {
      origin: origin ? mapGraphNode(origin) : null,
      // 画布会单独渲染 origin,nodes 中需排除,否则重复 key 且覆盖中心坐标
      nodes: nodes
        .filter((n) => n.id !== origin?.id)
        .map(mapGraphNode),
      edges: edges.map((e) => ({
        source: e.source,
        target: e.target,
        strength: e.strength,
        crossLayer: !!e.cross_layer,
      })),
      relatedIds: relatedRows.map((r) => r.node_id),
    };
    return ok(data);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "获取知识图谱失败");
  }
}
