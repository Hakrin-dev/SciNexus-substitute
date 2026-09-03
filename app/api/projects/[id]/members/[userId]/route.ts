import { NextRequest } from "next/server";
import { getDB } from "@/lib/server/db";
import { requireAuth } from "@/lib/server/auth";
import { canAccessProject, writeAudit } from "@/lib/server/workbench";
import { ensureSeed, fail, ok } from "@/lib/server/utils";

export const runtime = "nodejs";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; userId: string }> }) {
  ensureSeed();
  const { id, userId } = await params;
  const actor = requireAuth(req);
  if (!actor) return fail("请先登录", 401, "UNAUTHORIZED");
  if (!canAccessProject(id, actor.id, "admin")) return fail("没有成员管理权限", 403, "FORBIDDEN");
  const member = getDB().prepare("SELECT role FROM project_members WHERE project_id = ? AND user_id = ?").get(id, userId) as { role: string } | undefined;
  if (!member) return fail("成员不存在", 404);
  if (member.role === "owner") return fail("不能移除项目所有者", 409, "OWNER_IMMUTABLE");
  getDB().prepare("DELETE FROM project_members WHERE project_id = ? AND user_id = ?").run(id, userId);
  writeAudit({ userId: actor.id, projectId: id, action: "project_member.delete", resourceType: "user", resourceId: userId });
  return ok({ deleted: true });
}
