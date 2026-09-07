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
import { getCurrentUser, requireAuth } from "@/lib/server/auth";
import { genId } from "@/lib/server/utils";
import { logActivity, projectMembers, projectRole, writeAudit } from "@/lib/server/workbench";

export const runtime = "nodejs";

type ProjectRow = {
  id: string; name: string; tagline: string; status: string; progress: number;
  created_at: string; owner: string; overview_json: string; tech_stack_json: string;
  links_json: string; visibility: string; organization_id: string | null;
};
type MilestoneRow = { project_id: string; title: string; detail: string; status: string };

export async function GET(req: NextRequest) {
  ensureSeed();
  try {
    const user = getCurrentUser(req);
    const page = Math.max(1, getQueryInt(req, "page", 1));
    const pageSize = Math.min(100, Math.max(1, getQueryInt(req, "page_size", 20)));
    const status = getQuery(req, "status");

    const db = getDB();
    let sql = `SELECT DISTINCT p.* FROM projects p
      LEFT JOIN project_members pm ON pm.project_id=p.id AND pm.user_id=?
      LEFT JOIN organization_members om ON om.organization_id=p.organization_id AND om.user_id=?
      WHERE (p.visibility='public_readonly' OR p.user_id=? OR pm.user_id=? OR (p.visibility='organization' AND om.user_id=?))`;
    const uid = user?.id ?? "";
    const params: (string | number)[] = [uid, uid, uid, uid, uid];
    if (status) {
      sql += " AND status = ?";
      params.push(status);
    }
    sql += " ORDER BY created_at DESC";

    const total = (db.prepare(`SELECT COUNT(*) AS n FROM (${sql}) visible_projects`).get(...params) as { n: number }).n;

    sql += " LIMIT ? OFFSET ?";
    params.push(pageSize, (page - 1) * pageSize);

    const rows = db.prepare(sql).all(...params) as unknown as ProjectRow[];

    // 里程碑批量联查(列表项与详情同构,前端 attachment-menu 等消费 milestones 字段)
    const ids = rows.map((r) => r.id);
    const msByProject = new Map<string, { title: string; detail: string; status: string }[]>();
    if (ids.length) {
      const placeholders = ids.map(() => "?").join(",");
      const msRows = db
        .prepare(
          `SELECT * FROM project_milestones WHERE project_id IN (${placeholders}) ORDER BY sort_order, id`
        )
        .all(...ids) as unknown as MilestoneRow[];
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
      organizationId: r.organization_id || null,
      role: projectRole(r.id, user?.id),
      readOnly: !user || !["owner","admin","editor"].includes(projectRole(r.id,user.id) || ""),
    }));

    return okPaginated(data, page, pageSize, total);
  } catch (error: unknown) {
    return fail(error instanceof Error ? error.message : "获取项目列表失败");
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
      visibility?: "private" | "organization" | "public_readonly";
      organizationId?: string;
    }>(req);
    const projectName = body.name?.trim();
    if (!projectName) return fail("项目名称不能为空");
    if (projectName.length > 120) return fail("项目名称不能超过 120 字", 422);
    const tagline = body.tagline?.trim() ?? "";
    if (tagline.length > 500) return fail("项目简介不能超过 500 字", 422);

    const db = getDB();
    const id = genId("proj_");
    const questionId = genId("node_");
    const threadId = genId("thread_");
    const firstCardId = genId("card_");
    const now = new Date().toISOString().slice(0, 10);
    const createdAt = new Date().toISOString();
    const researchQuestion = tagline || `${projectName}需要解决的核心问题是什么？`;

    if (body.organizationId) {
      const role = db.prepare("SELECT role FROM organization_members WHERE organization_id=? AND user_id=?").get(body.organizationId, userId) as { role: string } | undefined;
      if (!role || !["owner","admin"].includes(role.role)) return fail("只有组织管理员可以创建组织项目",403,"FORBIDDEN");
    }
    const requested = (body.members || []).filter((m) => m.name?.trim());
    const resolved = requested.map((member) => ({
      member,
      user: db.prepare("SELECT id FROM users WHERE lower(username)=lower(?) OR lower(email)=lower(?)")
        .get(member.name.trim(), member.name.trim()) as { id: string } | undefined,
    }));
    const missing = resolved.find((x) => !x.user);
    if (missing) return fail(`成员“${missing.member.name}”尚未注册`, 422, "MEMBER_NOT_FOUND");
    const create = db.transaction(() => {
      db.prepare(
        `INSERT INTO projects (id,user_id,name,tagline,status,progress,created_at,owner,overview_json,tech_stack_json,members_json,links_json,visibility,organization_id)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      ).run(
        id, userId, projectName, tagline, body.status || "进行中", 0, now, userId,
        jsonStringify(body.overview || []), jsonStringify(body.techStack || []), "[]",
        jsonStringify(body.links || []), body.visibility || "private", body.organizationId || null,
      );
      db.prepare("INSERT INTO project_members (project_id,user_id,role,created_at) VALUES (?,?,'owner',?)")
        .run(id, userId, createdAt);
      const insert = db.prepare("INSERT OR IGNORE INTO project_members (project_id,user_id,role,created_at) VALUES (?,?,?,?)");
      for (const item of resolved) {
        if (!item.user || item.user.id === userId) continue;
        const role = item.member.role === "admin" ? "admin" : item.member.role === "viewer" ? "viewer" : "editor";
        insert.run(id, item.user.id, role, createdAt);
      }

    if (body.milestones?.length) {
      const insertMs = db.prepare(
        `INSERT INTO project_milestones (project_id, title, detail, status, sort_order) VALUES (?, ?, ?, 'todo', ?)`
      );
      body.milestones.forEach((m, i) => insertMs.run(id, m.title, m.detail || "", i));
    }
    db.prepare(`INSERT INTO wb_outline_nodes
      (id,project_id,parent_id,kind,title,status,detail,sort,asset_refs_json)
      VALUES (?,?,NULL,'question',?,'open',?,0,'[]')`)
      .run(questionId, id, researchQuestion, "创建课题时建立的初始研究问题，可在研究过程中继续细化。");
    db.prepare(`INSERT INTO wb_threads (id,project_id,question_node_id,title,stage)
      VALUES (?,?,?,?,?)`)
      .run(threadId, id, questionId, researchQuestion, "计划");
    db.prepare(`INSERT INTO wb_thread_cards
      (id,project_id,thread_id,kind,title,summary,stage,status,node_ref,ai_generated,created_at,asset_refs_json)
      VALUES (?,?,?,'question','建立课题研究目标',?,'plan','doing',?,0,?,'[]')`)
      .run(firstCardId, id, threadId, researchQuestion, questionId, createdAt);
    logActivity(db, {
      projectId: id,
      type: "task",
      text: `创建课题「${projectName}」并建立初始研究问题。`,
      threadId,
    });
    });
    create();
    writeAudit({userId,projectId:id,action:"project.create",resourceType:"project",resourceId:id});

    return ok({ id });
  } catch (error: unknown) {
    return fail(error instanceof Error ? error.message : "创建项目失败");
  }
}
