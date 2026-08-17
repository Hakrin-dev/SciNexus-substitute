/**
 * GET /api/venues
 * 获取投稿目标（会议/期刊）列表
 *
 * Query:
 *  - page, page_size, keyword
 *  - kind: conference | journal
 *  - sort_by: match | rate | deadline
 */
import { NextRequest } from "next/server";
import { ensureSeed, fail, okPaginated, getQuery, getQueryInt } from "@/lib/server/utils";
import { getDB, jsonParse } from "@/lib/server/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  ensureSeed();
  try {
    const page = Math.max(1, getQueryInt(req, "page", 1));
    const pageSize = Math.min(100, Math.max(1, getQueryInt(req, "page_size", 20)));
    const keyword = getQuery(req, "keyword");
    const kind = getQuery(req, "kind");
    const sortBy = getQuery(req, "sort_by", "match") || "match";

    const db = getDB();
    let sql = "SELECT * FROM venues WHERE 1=1";
    const params: any[] = [];

    if (keyword) {
      sql += " AND (LOWER(full_name) LIKE ? OR LOWER(abbr) LIKE ?)";
      const kw = `%${keyword.toLowerCase()}%`;
      params.push(kw, kw);
    }
    if (kind) {
      sql += " AND kind = ?";
      params.push(kind);
    }

    if (sortBy === "rate") sql += " ORDER BY (acceptance_rate * 100) DESC";
    else if (sortBy === "deadline") sql += " ORDER BY (deadline_offset_ms IS NOT NULL), deadline_offset_ms ASC";
    else sql += " ORDER BY match_pct DESC";

    const countSql = sql.replace("SELECT *", "SELECT COUNT(*) AS n");
    const total = (db.prepare(countSql).get(...params) as any).n;

    sql += " LIMIT ? OFFSET ?";
    params.push(pageSize, (page - 1) * pageSize);

    const rows = db.prepare(sql).all(...params) as any[];
    const data = rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      abbr: r.abbr,
      fullName: r.full_name,
      badges: jsonParse<any[]>(r.badges_json, []),
      metaRows: jsonParse<any[][]>(r.meta_rows_json, []),
      chips: jsonParse<string[]>(r.chips_json, []),
      accent: r.accent,
      deadline: r.deadline_label
        ? {
            label: r.deadline_label,
            dateText: r.deadline_date,
            offsetMs: r.deadline_offset_ms,
          }
        : undefined,
      matchPct: r.match_pct,
    }));

    return okPaginated(data, page, pageSize, total);
  } catch (e: any) {
    return fail(e.message || "获取投稿列表失败");
  }
}
