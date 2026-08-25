/**
 * GET  /api/library   - 获取文献库列表（支持 folder / tag / status 筛选）
 * POST /api/library   - 添加论文到文献库
 */
import { NextRequest } from "next/server";
import {
  ensureSeed,
  fail,
  ok,
  okPaginated,
  parseBody,
  getQuery,
  getQueryInt,
} from "@/lib/server/utils";
import { getDB, jsonParse, jsonStringify } from "@/lib/server/db";
import { requireAuth } from "@/lib/server/auth";
import { genId } from "@/lib/server/utils";

export const runtime = "nodejs";

/** sqlite "2026-07-25 14:33:21" → 「7月25日」(与前端 mock 展示约定一致) */
function formatAddedAt(raw?: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw ?? "");
  if (m) return `${Number(m[2])}月${Number(m[3])}日`;
  return raw ?? "";
}

export async function GET(req: NextRequest) {
  ensureSeed();
  try {
    const user = requireAuth(req);
    if (!user) return fail("请先登录", 401, "UNAUTHORIZED");
    const userId = user.id;
    const folder = getQuery(req, "folder");
    const tag = getQuery(req, "tag");
    const status = getQuery(req, "status");
    const sortBy = getQuery(req, "sort_by", "collected") || "collected";
    const page = Math.max(1, getQueryInt(req, "page", 1));
    const pageSize = Math.min(200, Math.max(1, getQueryInt(req, "page_size", 50)));

    const db = getDB();
    let sql = "SELECT * FROM library_items WHERE user_id = ?";
    const params: any[] = [userId];
    if (folder && folder !== "all") {
      sql += " AND folder = ?";
      params.push(folder);
    }
    if (status) {
      sql += " AND status = ?";
      params.push(status);
    }
    if (tag) {
      sql += " AND tags_json LIKE ?";
      params.push(`%${tag}%`);
    }

    const countSql = sql.replace("SELECT *", "SELECT COUNT(*) AS n");
    const total = (db.prepare(countSql).get(...params) as any).n;

    if (sortBy === "title") sql += " ORDER BY title ASC";
    else if (sortBy === "progress") sql += " ORDER BY reading_progress DESC";
    else sql += " ORDER BY added_at DESC";

    sql += " LIMIT ? OFFSET ?";
    params.push(pageSize, (page - 1) * pageSize);

    const rows = db.prepare(sql).all(...params) as any[];

    // 统计
    const all = db
      .prepare("SELECT status FROM library_items WHERE user_id = ?")
      .all(userId) as any[];
    const stats = {
      read: all.filter((x) => x.status === "read").length,
      reading: all.filter((x) => x.status === "reading").length,
      unread: all.filter((x) => x.status === "unread").length,
    };

    const data = rows.map((r) => ({
      id: r.paper_id || r.id,
      recordId: r.id,
      title: r.title,
      venue: r.venue,
      arxiv: r.arxiv,
      authors: r.authors,
      addedAt: formatAddedAt(r.added_at),
      pdfTone: r.pdf_tone,
      folder: r.folder,
      tags: jsonParse<string[]>(r.tags_json, []),
      status: r.status,
      readingProgress: r.reading_progress,
    }));

    const resp = okPaginated(data, page, pageSize, total, { stats });
    return resp;
  } catch (e: any) {
    return fail(e.message || "获取文献库失败");
  }
}

export async function POST(req: NextRequest) {
  ensureSeed();
  try {
    const user = requireAuth(req);
    if (!user) return fail("请先登录", 401, "UNAUTHORIZED");
    const userId = user.id;
    const body = await parseBody<{
      paper_id?: string;
      title: string;
      venue?: string;
      arxiv?: string;
      authors?: string;
      folder?: string;
      tags?: string[];
      pdf_tone?: "violet" | "amber" | "green";
    }>(req);
    if (!body.title) return fail("论文标题不能为空");

    const db = getDB();
    const id = body.paper_id ? `lib_${body.paper_id}_${Math.random().toString(36).slice(2, 6)}` : genId("lib_");
    const tones: Array<"violet" | "amber" | "green"> = ["violet", "amber", "green"];
    const tone = body.pdf_tone || tones[Math.floor(Math.random() * tones.length)];

    db.prepare(
      `INSERT INTO library_items (id, user_id, paper_id, title, venue, arxiv, authors, folder, tags_json, pdf_tone, status, reading_progress)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unread', 0)`
    ).run(
      id,
      userId,
      body.paper_id || null,
      body.title,
      body.venue || "",
      body.arxiv || "",
      body.authors || "",
      body.folder || "默认",
      jsonStringify(body.tags || []),
      tone
    );
    return ok({ id });
  } catch (e: any) {
    return fail(e.message || "添加到文献库失败");
  }
}
