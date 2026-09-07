/**
 * GET    /api/projects/[id] - 获取项目详情（含里程碑）
 * PUT    /api/projects/[id] - 更新项目信息
 * DELETE /api/projects/[id] - 删除项目
 */
import { NextRequest } from "next/server";
import { ensureSeed, fail, ok, parseBody } from "@/lib/server/utils";
import { getDB, jsonParse, jsonStringify } from "@/lib/server/db";
import { getCurrentUser, requireAuth } from "@/lib/server/auth";
import { canAccessProject, projectMembers, projectRole, writeAudit } from "@/lib/server/workbench";

export const runtime = "nodejs";

type ProjectRow = Record<string, unknown>;
type MilestoneInput = { title?: string; detail?: string; status?: "todo" | "doing" | "done" };
type ProjectUpdate = {
  name?: string; tagline?: string; status?: "进行中" | "已完成" | "已搁置"; progress?: number;
  overview?: string[]; techStack?: string[]; links?: { label: string; href: string }[];
  visibility?: "private" | "organization" | "public_readonly"; milestones?: MilestoneInput[];
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  ensureSeed();
  const { id } = await params;
  try {
    const user = getCurrentUser(req);
    if (!canAccessProject(id, user?.id, "read")) return fail("项目不存在", 404);
    const db = getDB();
    const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as ProjectRow | undefined;
    if (!row) return fail("项目不存在", 404);

    const msRows = db
      .prepare("SELECT * FROM project_milestones WHERE project_id = ? ORDER BY sort_order, id")
      .all(id) as unknown as ProjectRow[];

    const data = {
      id: row.id,
      name: row.name,
      tagline: row.tagline,
      status: row.status,
      progress: row.progress,
      createdAt: row.created_at,
      owner: row.owner,
      overview: jsonParse<string[]>(typeof row.overview_json === "string" ? row.overview_json : null, []),
      techStack: jsonParse<string[]>(typeof row.tech_stack_json === "string" ? row.tech_stack_json : null, []),
      members: projectMembers(id),
      links: jsonParse(typeof row.links_json === "string" ? row.links_json : null, []),
      milestones: msRows.map((m) => ({
        title: m.title,
        detail: m.detail,
        status: m.status,
      })),
      visibility: row.visibility,
      organizationId: row.organization_id || null,
      role: projectRole(id,user?.id),
      readOnly: !canAccessProject(id,user?.id,"write"),
    };
    return ok(data);
  } catch (error: unknown) {
    return fail(error instanceof Error ? error.message : "获取项目详情失败");
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  ensureSeed();
  const { id } = await params;
  try {
    const user = requireAuth(req);
    if (!user) return fail("请先登录", 401, "UNAUTHORIZED");
    if (!canAccessProject(id, user.id, "write")) return fail("没有项目编辑权限", 403, "FORBIDDEN");
    const body = await parseBody<ProjectUpdate>(req);
    const db = getDB();
    if (body.visibility !== undefined && !canAccessProject(id, user.id, "admin")) return fail("只有项目管理员可以修改可见性", 403, "FORBIDDEN");

    const exists = db.prepare("SELECT 1 FROM projects WHERE id = ?").get(id);
    if (!exists) return fail("项目不存在", 404);

    const fields: string[] = [];
    const vals: (string | number)[] = [];
    const set = (column: string, value: string | number) => { fields.push(`${column} = ?`); vals.push(value); };
    if (body.name !== undefined) {
      const name = body.name.trim();
      if (!name || name.length > 120) return fail("项目名称须为 1–120 字", 422);
      set("name", name);
    }
    if (body.tagline !== undefined) {
      if (body.tagline.length > 500) return fail("项目简介不能超过 500 字", 422);
      set("tagline", body.tagline.trim());
    }
    if (body.status !== undefined) set("status", body.status);
    if (body.progress !== undefined) set("progress", Math.min(100, Math.max(0, Number(body.progress) || 0)));
    if (body.overview !== undefined) {
      if (!Array.isArray(body.overview)) return fail("overview 必须是数组", 422);
      set("overview_json", jsonStringify(body.overview));
    }
    if (body.techStack !== undefined) {
      if (!Array.isArray(body.techStack)) return fail("techStack 必须是数组", 422);
      set("tech_stack_json", jsonStringify(body.techStack));
    }
    if (body.links !== undefined) {
      if (!Array.isArray(body.links)) return fail("links 必须是数组", 422);
      set("links_json", jsonStringify(body.links));
    }
    if (body.visibility !== undefined) set("visibility", body.visibility);
    fields.push("updated_at = datetime('now','localtime')");

    if (fields.length) {
      vals.push(id);
      db.prepare(`UPDATE projects SET ${fields.join(", ")} WHERE id = ?`).run(...vals);
    }

    // 更新里程碑
    if (Array.isArray(body.milestones)) {
      db.prepare("DELETE FROM project_milestones WHERE project_id = ?").run(id);
      const insertMs = db.prepare(
        `INSERT INTO project_milestones (project_id, title, detail, status, sort_order) VALUES (?, ?, ?, ?, ?)`
      );
      body.milestones.forEach((m, i) =>
        insertMs.run(id, m.title || "", m.detail || "", m.status || "todo", i)
      );
    }
    writeAudit({userId:user.id,projectId:id,action:"project.update",resourceType:"project",resourceId:id});
    return ok({ updated: true });
  } catch (error: unknown) {
    return fail(error instanceof Error ? error.message : "更新项目失败");
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  ensureSeed();
  const { id } = await params;
  try {
    const user = requireAuth(req);
    if (!user) return fail("请先登录", 401, "UNAUTHORIZED");
    if (!canAccessProject(id,user.id,"owner")) return fail("只有项目所有者可以删除项目",403,"FORBIDDEN");
    const db = getDB();
    const r = db.prepare("DELETE FROM projects WHERE id = ?").run(id);
    if (r.changes === 0) return fail("项目不存在", 404);
    writeAudit({userId:user.id,action:"project.delete",resourceType:"project",resourceId:id});
    return ok({ deleted: true });
  } catch (error: unknown) {
    return fail(error instanceof Error ? error.message : "删除项目失败");
  }
}
