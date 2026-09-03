import { NextRequest } from "next/server";
import { getDB } from "@/lib/server/db";
import { requireAuth } from "@/lib/server/auth";
import { canAccessProject, writeAudit } from "@/lib/server/workbench";
import { ensureSeed, fail, ok, parseBody } from "@/lib/server/utils";

export const runtime = "nodejs";
const ROLES = new Set(["admin", "editor", "viewer"]);

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  ensureSeed();
  const { id } = await params;
  const user = requireAuth(req);
  if (!user) return fail("请先登录", 401, "UNAUTHORIZED");
  if (!canAccessProject(id, user.id, "admin")) return fail("没有成员管理权限", 403, "FORBIDDEN");
  const rows = getDB().prepare(`SELECT pm.user_id AS userId, pm.role, pm.created_at AS createdAt,
      u.username, u.email, u.display_name AS displayName
    FROM project_members pm JOIN users u ON u.id = pm.user_id
    WHERE pm.project_id = ? ORDER BY CASE pm.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'editor' THEN 2 ELSE 3 END, pm.created_at`).all(id);
  return ok(rows);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  ensureSeed();
  const { id } = await params;
  const actor = requireAuth(req);
  if (!actor) return fail("请先登录", 401, "UNAUTHORIZED");
  if (!canAccessProject(id, actor.id, "admin")) return fail("没有成员管理权限", 403, "FORBIDDEN");
  const body = await parseBody<{ username?: string; role?: string }>(req);
  if (!body.username || !body.role || !ROLES.has(body.role)) return fail("用户名或角色无效", 422, "INVALID_MEMBER");
  const target = getDB().prepare("SELECT id FROM users WHERE username = ? OR email = ?").get(body.username, body.username) as { id: string } | undefined;
  if (!target) return fail("用户不存在", 404, "USER_NOT_FOUND");
  getDB().prepare(`INSERT INTO project_members (project_id, user_id, role, created_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(project_id, user_id) DO UPDATE SET role = excluded.role`).run(id, target.id, body.role, new Date().toISOString());
  writeAudit({ userId: actor.id, projectId: id, action: "project_member.upsert", resourceType: "user", resourceId: target.id, metadata: { role: body.role } });
  return ok({ userId: target.id, role: body.role });
}
