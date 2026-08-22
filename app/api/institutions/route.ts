/**
 * GET /api/institutions
 * 获取研究机构列表
 *
 * Query:
 *  - page, page_size, keyword
 *  - type: 高校 | 研究院 | 企业实验室
 *  - sort_by: rank | papers
 */
import { NextRequest } from "next/server";
import { ensureSeed, fail, okPaginated, getQuery, getQueryInt } from "@/lib/server/utils";
import { getDB, jsonParse } from "@/lib/server/db";
import { getCurrentUser } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  ensureSeed();
  try {
    const userId = getCurrentUser(req)?.id ?? "";
    const page = Math.max(1, getQueryInt(req, "page", 1));
    const pageSize = Math.min(100, Math.max(1, getQueryInt(req, "page_size", 20)));
    const keyword = getQuery(req, "keyword");
    const type = getQuery(req, "type");
    const sortBy = getQuery(req, "sort_by", "rank") || "rank";

    const db = getDB();

    let sql = `
      SELECT i.*,
             CASE WHEN bi.institution_id IS NOT NULL THEN 1 ELSE (i.bookmarked OR 0) END AS bookmarked
      FROM institutions i
      LEFT JOIN bookmarked_institutions bi ON bi.user_id = ? AND bi.institution_id = i.id
      WHERE 1=1
    `;
    const params: any[] = [userId];

    if (keyword) {
      sql += " AND (LOWER(i.name_cn) LIKE ? OR LOWER(i.name_en) LIKE ? OR LOWER(i.intro) LIKE ?)";
      const kw = `%${keyword.toLowerCase()}%`;
      params.push(kw, kw, kw);
    }
    if (type) {
      sql += " AND i.type = ?";
      params.push(type);
    }

    if (sortBy === "papers") sql += " ORDER BY i.papers_per_year DESC";
    else sql += " ORDER BY i.rank ASC";

    const countSql = sql.replace(
      "SELECT i.*, CASE WHEN bi.institution_id IS NOT NULL THEN 1 ELSE (i.bookmarked OR 0) END AS bookmarked",
      "SELECT COUNT(*) AS n"
    );
    const total = (db.prepare(countSql).get(...params) as any).n;

    sql += " LIMIT ? OFFSET ?";
    params.push(pageSize, (page - 1) * pageSize);

    const rows = db.prepare(sql).all(...params) as any[];
    const data = rows.map((r) => ({
      id: r.id,
      nameCn: r.name_cn,
      nameEn: r.name_en,
      initials: r.initials,
      logoColor: r.logo_color,
      type: r.type,
      location: r.location,
      intro: r.intro,
      stats: jsonParse(r.stats_json, []),
      fields: jsonParse<string[]>(r.fields_json, []),
      highlight: r.highlight,
      bookmarked: !!r.bookmarked,
      rank: r.rank,
      papersPerYear: r.papers_per_year,
    }));

    return okPaginated(data, page, pageSize, total);
  } catch (e: any) {
    return fail(e.message || "获取机构列表失败");
  }
}
