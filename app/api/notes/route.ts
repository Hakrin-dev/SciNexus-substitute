/**
 * GET  /api/notes - 笔记列表（keyword 匹配标题/内容，tag 筛选）
 * POST /api/notes - 新建笔记  Body: { title?, content?, tags?, paper_id? }
 */
import { NextRequest } from "next/server";
import { ensureSeed, fail, genId, ok, parseBody } from "@/lib/server/utils";
import { getDB, jsonParse } from "@/lib/server/db";
import { requireAuth } from "@/lib/server/auth";

export const runtime = "nodejs";

/** LIKE 通配符转义（避免用户输入 %/_/[ 破坏匹配） */
function escapeLike(input: string): string {
  return input.replace(/\[/g, "[").replace(/%/g, "[%").replace(/_/g, "[_");
}

function mapRow(r: any) {
  return {
    id: r.id,
    title: r.title ?? "",
    content: r.content ?? "",
    tags: jsonParse<string[]>(r.tags_json, []),
    ...(r.paper_id ? { paperId: r.paper_id } : {}),
    ...(r.paper_title ? { paperTitle: r.paper_title } : {}),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function GET(req: NextRequest) {
  ensureSeed();
  try {
    const user = requireAuth(req);
    if (!user) return fail("请先登录", 401, "UNAUTHORIZED");

    const url = new URL(req.url);
    const keyword = (url.searchParams.get("keyword") || "").trim();
    const tag = (url.searchParams.get("tag") || "").trim();

    const db = getDB();
    let sql =
      "SELECT n.*, p.title AS paper_title FROM notes n LEFT JOIN papers p ON p.id = n.paper_id WHERE n.user_id = ?";
    const params: (string | number)[] = [user.id];
    if (keyword) {
      const like = `%${escapeLike(keyword)}%`;
      sql += " AND (n.title LIKE ? ESCAPE '\\' OR n.content LIKE ? ESCAPE '\\')";
      params.push(like, like);
    }
    if (tag) {
      sql += " AND n.tags_json LIKE ? ESCAPE '\\'";
      params.push(`%"${escapeLike(tag)}"%`);
    }
    sql += " ORDER BY n.updated_at DESC";

    const rows = db.prepare(sql).all(...params) as any[];
    return ok(rows.map(mapRow));
  } catch (e: any) {
    return fail(e.message || "获取笔记失败");
  }
}

export async function POST(req: NextRequest) {
  ensureSeed();
  try {
    const user = requireAuth(req);
    if (!user) return fail("请先登录", 401, "UNAUTHORIZED");

    const body = await parseBody<{
      title?: string;
      content?: string;
      tags?: string[];
      paper_id?: string;
    }>(req);
    const title = (body.title || "").trim();
    const content = (body.content || "").trim();
    if (!title && !content) return fail("标题和内容至少填一项");
    const tags = Array.from(
      new Set((body.tags || []).map((t) => String(t).trim()).filter(Boolean))
    ).slice(0, 10);

    const db = getDB();
    const id = genId("n_");
    db.prepare(
      `INSERT INTO notes (id, user_id, title, content, tags_json, paper_id)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      user.id,
      title || "无标题笔记",
      content,
      JSON.stringify(tags),
      body.paper_id || null
    );

    const row = db
      .prepare(
        "SELECT n.*, p.title AS paper_title FROM notes n LEFT JOIN papers p ON p.id = n.paper_id WHERE n.id = ?"
      )
      .get(id) as any;
    return ok(mapRow(row));
  } catch (e: any) {
    return fail(e.message || "新建笔记失败");
  }
}