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
import { genId } from "@/lib/server/utils";
import { getCurrentUser, requireAuth } from "@/lib/server/auth";
import { projectMembers, projectRole, writeAudit } from "@/lib/server/workbench";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  ensureSeed();
  try {
    const page = Math.max(1, getQueryInt(req, "page", 1));
    const pageSize = Math.min(100, Math.max(1, getQueryInt(req, "page_size", 20)));
    const status = getQuery(req, "status");
    const user = getCurrentUser(req);

    const db = getDB();
    let sql = `SELECT DISTINCT p.* FROM projects p
      LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ?
      LEFT JOIN organization_members om ON om.organization_id = p.organization_id AND om.user_id = ?
      WHERE (p.visibility = 'public_readonly' OR p.user_id = ? OR pm.user_id = ? OR (p.visibility = 'organization' AND om.user_id = ?))`;
    const params: any[] = [user?.id ?? "", user?.id ?? "", user?.id ?? "", user?.id ?? "", user?.id ?? ""];
    if (status) {
      sql += " AND p.status = ?";
      params.push(status);
    }
    sql += " ORDER BY p.created_at DESC";

    const countSql = `SELECT COUNT(*) AS n FROM (${sql}) visible_projects`;
    const total = (db.prepare(countSql).get(...params) as any).n;

    sql += " LIMIT ? OFFSET ?";
    params.push(pageSize, (page - 1) * pageSize);

    const rows = db.prepare(sql).all(...params) as any[];

    // 里程碑批量联查(列表项与详情同构,前端 attachment-menu 等消费 milestones 字段)
    const ids = rows.map((r) => r.id);
    const msByProject = new Map<string, { title: string; detail: string; status: string }[]>();
    if (ids.length) {
      const placeholders = ids.map(() => "?").join(",");
      const msRows = db
        .prepare(
          `SELECT * FROM project_milestones WHERE project_id IN (${placeholders}) ORDER BY sort_order, id`
        )
        .all(...ids) as any[];
      for (const m of msRows) {
        const list = msByProject.get(m.project_id) || [];
        list.push({ title: m.title, detail: m.detail, status: m.status });
        msByProject.set(m.project_id, list);
      }
    }

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
      members: projectMembers(r.id),
      links: jsonParse(r.links_json, []),
      milestones: msByProject.get(r.id) || [],
      visibility: r.visibility,
      role: projectRole(r.id, user?.id),
      readOnly: !user || !["owner", "admin", "editor"].includes(projectRole(r.id, user.id) || ""),
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
      organizationId?: string;
    }>(req);
    if (!body.name) return fail("项目名称不能为空");

    const db = getDB();
    if (body.organizationId) {
      const organizationRole = db.prepare("SELECT role FROM organization_members WHERE organization_id = ? AND user_id = ?").get(body.organizationId, userId) as { role?: string } | undefined;
      if (!organizationRole || !["owner", "admin"].includes(organizationRole.role || "")) return fail("只有组织管理员可以在该组织中创建项目", 403, "FORBIDDEN");
    }
    const requestedMembers = (body.members || []).filter((member) => member.name?.trim());
    const resolvedMembers = requestedMembers.map((member) => ({ member, user: db.prepare("SELECT id FROM users WHERE lower(username) = lower(?) OR lower(email) = lower(?)").get(member.name.trim(), member.name.trim()) as { id: string } | undefined }));
    const missingMember = resolvedMembers.find((item) => !item.user);
    if (missingMember) return fail(`成员“${missingMember.member.name}”尚未注册`, 422, "MEMBER_NOT_FOUND");
    const id = genId("proj_");
    const now = new Date().toISOString().slice(0, 10);

    const create = db.transaction(() => {
    db.prepare(
      `INSERT INTO projects (id, user_id, name, tagline, status, progress, created_at, owner, overview_json, tech_stack_json, members_json, links_json, organization_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
      "[]",
      jsonStringify(body.links || []),
      body.organizationId || null
    );
    db.prepare("INSERT INTO project_members (project_id, user_id, role, created_at) VALUES (?, ?, 'owner', ?)")
      .run(id, userId, new Date().toISOString());
    const insertMember = db.prepare("INSERT OR IGNORE INTO project_members (project_id, user_id, role, created_at) VALUES (?, ?, ?, ?)");
    for (const { member, user: memberUser } of resolvedMembers) {
      if (!memberUser || memberUser.id === userId) continue;
      const requestedRole = member.role.toLowerCase();
      const role = requestedRole.includes("admin") || member.role.includes("管理") ? "admin" : requestedRole.includes("view") || member.role.includes("只读") || member.role.includes("观察") ? "viewer" : "editor";
      insertMember.run(id, memberUser.id, role, new Date().toISOString());
    }

    if (body.milestones?.length) {
      const insertMs = db.prepare(
        `INSERT INTO project_milestones (project_id, title, detail, status, sort_order) VALUES (?, ?, ?, 'todo', ?)`
      );
      body.milestones.forEach((m, i) => insertMs.run(id, m.title, m.detail || "", i));
    }
    });
    create();
    writeAudit({ userId, projectId: id, action: "project.create", resourceType: "project", resourceId: id });

    return ok({ id });
  } catch (e: any) {
    return fail(e.message || "创建项目失败");
  }
}
