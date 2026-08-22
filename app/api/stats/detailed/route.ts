/**
 * GET /api/stats/detailed
 * 详细统计：论文 CCF 分布、文献库阅读状态分布等
 */
import { NextResponse } from "next/server";
import { ensureSeed } from "@/lib/server/utils";
import { getDB } from "@/lib/server/db";

export const runtime = "nodejs";

export async function GET() {
  ensureSeed();
  const db = getDB();

  const papersByCcf = db.prepare("SELECT ccf, COUNT(*) as n FROM papers GROUP BY ccf").all() as any[];
  const libByStatus = db.prepare("SELECT status, COUNT(*) as n FROM library_items GROUP BY status").all() as any[];

  const count = (table: string) => (db.prepare(`SELECT COUNT(*) as n FROM ${table}`).get() as any).n;

  const byCcf: Record<string, number> = {};
  for (const r of papersByCcf) byCcf[r.ccf || "未知"] = r.n;

  const byStatus: Record<string, number> = {};
  for (const r of libByStatus) byStatus[r.status || "unread"] = r.n;

  return NextResponse.json({
    success: true,
    papers: { total: count("papers"), by_ccf: byCcf },
    journals: { total: count("venues") },
    library: { total: count("library_items"), by_status: byStatus },
    conversations: { total: count("conversations") },
    notifications: { total: count("notifications") },
  });
}
