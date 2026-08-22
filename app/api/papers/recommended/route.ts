/**
 * GET /api/papers/recommended
 * 每日推荐论文（按引用量/点赞数排序）
 *
 * Query:
 *  - limit: 返回数量 (默认 9, 最大 20)
 */
import { NextRequest } from "next/server";
import { ensureSeed, fail, ok, getQueryInt } from "@/lib/server/utils";
import { getDB, mapPaper } from "@/lib/server/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  ensureSeed();
  try {
    const limit = Math.min(20, Math.max(1, getQueryInt(req, "limit", 9)));
    const db = getDB();
    const rows = db
      .prepare(
        "SELECT * FROM papers ORDER BY citations DESC, likes DESC LIMIT ?"
      )
      .all(limit) as any[];
    const data = rows.map(mapPaper);
    return ok(data, {
      headers: { "X-Updated": new Date().toISOString().slice(0, 10) },
    });
  } catch (e: any) {
    return fail(e.message || "获取推荐论文失败");
  }
}
