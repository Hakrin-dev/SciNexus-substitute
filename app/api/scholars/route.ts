/**
 * GET /api/scholars
 * 获取学者列表，支持分页、关键词搜索
 *
 * Query:
 *  - page, page_size, keyword, sort_by
 *  - direction: 按研究方向筛选
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
    const sortBy = getQuery(req, "sort_by", "citations") || "citations";
    const direction = getQuery(req, "direction");

    const db = getDB();

    let sql = `
      SELECT s.*,
             CASE WHEN fs.scholar_id IS NOT NULL THEN 1 ELSE 0 END AS followed
      FROM scholars s
      LEFT JOIN followed_scholars fs ON fs.user_id = ? AND fs.scholar_id = s.id
      WHERE 1=1
    `;
    const params: any[] = [userId];

    if (keyword) {
      sql += " AND (LOWER(s.name_cn) LIKE ? OR LOWER(s.name_en) LIKE ? OR LOWER(s.affiliation) LIKE ?)";
      const kw = `%${keyword.toLowerCase()}%`;
      params.push(kw, kw, kw);
    }
    if (direction) {
      sql += " AND s.tags_json LIKE ?";
      params.push(`%${direction}%`);
    }

    // 排序：citation_count 为数值列，避免对 "849k"/"1.1M" 字符串排序失准
    if (sortBy === "citations") {
      sql += " ORDER BY s.citation_count DESC, s.h_index DESC";
    } else if (sortBy === "h_index") {
      sql += " ORDER BY s.h_index DESC, s.citation_count DESC";
    } else {
      sql += " ORDER BY s.h_index DESC, s.citation_count DESC";
    }

    const countSql = sql.replace(
      "SELECT s.*, CASE WHEN fs.scholar_id IS NOT NULL THEN 1 ELSE 0 END AS followed",
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
      avatarColor: r.avatar_color,
      role: r.role,
      affiliation: r.affiliation,
      bio: r.bio,
      citations: r.citations,
      hIndex: r.h_index,
      tags: jsonParse<string[]>(r.tags_json, []),
      followed: !!r.followed,
    }));

    return okPaginated(data, page, pageSize, total);
  } catch (e: any) {
    return fail(e.message || "获取学者列表失败");
  }
}
