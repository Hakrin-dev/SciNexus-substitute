/**
 * GET /api/projects   - 获取当前用户项目列表
 * POST /api/projects  - 创建新项目
 */
import { NextRequest } from "next/server";
import {
  ensureSeed,
  fail,
  ok,
  parseBody,
  getQuery,
  getQueryInt,
  okPaginated,
} from "@/lib/server/utils";
import { getDB, jsonParse, jsonStringify } from "@/lib/server/db";
import { requireAuth } from "@/lib/server/auth";
import { genId } from "@/lib/server/utils";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  ensureSeed();
  try {
    const user = requireAuth(req);
    if (!user) return fail("请先登录", 401, "UNAUTHORIZED");
    const userId = user.id;
    const page = Math.max(1, getQueryInt(req, "page", 1));
    const pageSize = Math.min(100, Math.max(1, getQueryInt(req, "page_size", 20)));
    const status = getQuery(req, "status");

    const db = getDB();
    let sql = "SELECT * FROM projects WHERE user_id = ?";
    const params: any[] = [userId];
    if (status) {
      sql += " AND status = ?";
      params.push(status);
    }
    sql += " ORDER BY created_at DESC";

    const countSql = sql.replace("SELECT *", "SELECT COUNT(*) AS n");
    const total = (db.prepare(countSql).get(...params) as any).n;

    sql += " LIMIT ? OFFSET ?";
    params.push(pageSize, (page - 1) * pageSize);

    const rows = db.prepare(sql).all(...params) as any[];
    const data = rows.map((r) => ({
      id: r.id,
      name: r.name,
      tagline: r.tagline,
      status: r.status,
      progress: r.progress,
      createdAt: r.created_at,
      owner: r.owner,
      overview: jsonParse<string[]>(r.overview_json, []),
      techStack: jsonParse<string[]>(r.tech_stack_json, []),
      members: jsonParse(r.members_json, []),
      links: jsonParse(r.links_json, []),
    }));

    return okPaginated(data, page, pageSize, total);
  } catch (e: any) {
    return fail(e.message || "获取项目列表失败");
  }
}

export async function POST(req: NextRequest) {
  ensureSeed();
  try {
    const user = requireAuth(req);
    if (!user) return fail("请先登录", 401, "UNAUTHORIZED");
    const userId = user.id;
    const body = await parseBody<{
      name: string;
      tagline?: string;
      status?: "进行中" | "已完成" | "已搁置";
      overview?: string[];
      techStack?: string[];
      milestones?: { title: string; detail: string }[];
      members?: { name: string; role: string }[];
      links?: { label: string; href: string }[];
    }>(req);
    if (!body.name) return fail("项目名称不能为空");

    const db = getDB();
    const id = genId("proj_");
    const now = new Date().toISOString().slice(0, 10);

    db.prepare(
      `INSERT INTO projects (id, user_id, name, tagline, status, progress, created_at, owner, overview_json, tech_stack_json, members_json, links_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      userId,
      body.name,
      body.tagline || "",
      body.status || "进行中",
      0,
      now,
      userId,
      jsonStringify(body.overview || []),
      jsonStringify(body.techStack || []),
      jsonStringify(body.members || []),
      jsonStringify(body.links || [])
    );

    if (body.milestones?.length) {
      const insertMs = db.prepare(
        `INSERT INTO project_milestones (project_id, title, detail, status, sort_order) VALUES (?, ?, ?, 'todo', ?)`
      );
      body.milestones.forEach((m, i) => insertMs.run(id, m.title, m.detail || "", i));
    }

    return ok({ id });
  } catch (e: any) {
    return fail(e.message || "创建项目失败");
  }
}
