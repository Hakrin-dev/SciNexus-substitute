/**
 * GET /api/papers
 * 获取论文列表（Feed 流），支持分页、筛选、搜索
 *
 * Query:
 *  - page: 页码 (默认 1)
 *  - page_size: 每页数量 (默认 10, 最大 100)
 *  - sort_by: relevance | citations | date (默认 date)
 *  - ccf: A | B | C | 预印本
 *  - year: 年份
 *  - keyword: 标题/摘要关键词
 */
import { NextRequest } from "next/server";
import { ensureSeed, fail, okPaginated, getQuery, getQueryInt } from "@/lib/server/utils";
import { getDB, mapPaper } from "@/lib/server/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  ensureSeed();
  const db = getDB();
  try {
    const page = Math.max(1, getQueryInt(req, "page", 1));
    const pageSize = Math.min(100, Math.max(1, getQueryInt(req, "page_size", 10)));
    const sortBy = getQuery(req, "sort_by", "date") || "date";
    const ccf = getQuery(req, "ccf");
    const year = getQueryInt(req, "year", 0);
    const keyword = getQuery(req, "keyword");

    let sql = "SELECT * FROM papers WHERE 1=1";
    const params: any[] = [];

    if (ccf) {
      sql += " AND ccf = ?";
      params.push(ccf);
    }
    if (year) {
      sql += " AND year = ?";
      params.push(year);
    }
    if (keyword) {
      sql += " AND (LOWER(title) LIKE ? OR LOWER(abstract) LIKE ?)";
      const kw = `%${keyword.toLowerCase()}%`;
      params.push(kw, kw);
    }

    // 排序
    if (sortBy === "citations") {
      sql += " ORDER BY citations DESC";
    } else if (sortBy === "date") {
      sql += " ORDER BY date DESC";
    } else {
      sql += " ORDER BY likes DESC, citations DESC";
    }

    // 总数
    const countSql = sql.replace("SELECT *", "SELECT COUNT(*) AS n");
    const total = (db.prepare(countSql).get(...params) as any).n;

    // 分页
    sql += " LIMIT ? OFFSET ?";
    params.push(pageSize, (page - 1) * pageSize);

    const rows = db.prepare(sql).all(...params) as any[];
    const data = rows.map(mapPaper);

    return okPaginated(data, page, pageSize, total);
  } catch (e: any) {
    return fail(e.message || "获取论文列表失败");
  }
}
