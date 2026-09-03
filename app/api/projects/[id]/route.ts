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

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  ensureSeed();
  const { id } = await params;
  try {
    const user = getCurrentUser(req);
    if (!canAccessProject(id, user?.id, "read")) return fail("项目不存在", 404);
    const db = getDB();
    const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as any;
    if (!row) return fail("项目不存在", 404);

    const msRows = db
      .prepare("SELECT * FROM project_milestones WHERE project_id = ? ORDER BY sort_order, id")
      .all(id) as any[];

    const data = {
      id: row.id,
      name: row.name,
      tagline: row.tagline,
      status: row.status,
      progress: row.progress,
      createdAt: row.created_at,
      owner: row.owner,
      overview: jsonParse<string[]>(row.overview_json, []),
      techStack: jsonParse<string[]>(row.tech_stack_json, []),
      members: projectMembers(id),
      links: jsonParse(row.links_json, []),
      milestones: msRows.map((m) => ({
        title: m.title,
        detail: m.detail,
        status: m.status,
      })),
      visibility: row.visibility,
      role: projectRole(id, user?.id),
      readOnly: !canAccessProject(id, user?.id, "write"),
    };
    return ok(data);
  } catch (e: any) {
    return fail(e.message || "获取项目详情失败");
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  ensureSeed();
  const { id } = await params;
  try {
    const user = requireAuth(req);
    if (!user) return fail("请先登录", 401, "UNAUTHORIZED");
    if (!canAccessProject(id, user.id, "write")) return fail("没有项目编辑权限", 403, "FORBIDDEN");
    const body = await parseBody<any>(req);
    if (body.visibility !== undefined && !canAccessProject(id, user.id, "admin")) {
      return fail("只有项目管理员可以修改可见性", 403, "FORBIDDEN");
    }
    const db = getDB();

    const exists = db.prepare("SELECT 1 FROM projects WHERE id = ?").get(id);
    if (!exists) return fail("项目不存在", 404);

    const fields: string[] = [];
    const vals: any[] = [];
    const possibleFields: Record<string, (v: any) => [string, any]> = {
      name: (v) => ["name", v],
      tagline: (v) => ["tagline", v],
      status: (v) => ["status", v],
      progress: (v) => ["progress", Math.min(100, Math.max(0, Number(v) || 0))],
      overview: (v) => ["overview_json", jsonStringify(v || [])],
      techStack: (v) => ["tech_stack_json", jsonStringify(v || [])],
      links: (v) => ["links_json", jsonStringify(v || [])],
      visibility: (v) => ["visibility", ["private", "organization", "public_readonly"].includes(v) ? v : "private"],
    };
    for (const key of Object.keys(body)) {
      if (possibleFields[key] && body[key] !== undefined) {
        const [col, val] = possibleFields[key](body[key]);
        fields.push(`${col} = ?`);
        vals.push(val);
      }
    }
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
      body.milestones.forEach((m: any, i: number) =>
        insertMs.run(id, m.title || "", m.detail || "", m.status || "todo", i)
      );
    }
    writeAudit({ userId: user.id, projectId: id, action: "project.update", resourceType: "project", resourceId: id });
    return ok({ updated: true });
  } catch (e: any) {
    return fail(e.message || "更新项目失败");
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  ensureSeed();
  const { id } = await params;
  try {
    const user = requireAuth(req);
    if (!user) return fail("请先登录", 401, "UNAUTHORIZED");
    if (!canAccessProject(id, user.id, "owner")) return fail("只有项目所有者可以删除项目", 403, "FORBIDDEN");
    const db = getDB();
    const r = db.prepare("DELETE FROM projects WHERE id = ?").run(id);
    if (r.changes === 0) return fail("项目不存在", 404);
    writeAudit({ userId: user.id, action: "project.delete", resourceType: "project", resourceId: id });
    return ok({ deleted: true });
  } catch (e: any) {
    return fail(e.message || "删除项目失败");
  }
}
