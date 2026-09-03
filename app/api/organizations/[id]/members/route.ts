import { NextRequest } from "next/server";
import { getDB } from "@/lib/server/db";
import { requireAuth } from "@/lib/server/auth";
import { ensureSeed, fail, ok, parseBody } from "@/lib/server/utils";
import { writeAudit } from "@/lib/server/workbench";

export const runtime = "nodejs";

function canManage(organizationId: string, userId: string) {
  const row = getDB().prepare("SELECT role FROM organization_members WHERE organization_id = ? AND user_id = ?").get(organizationId, userId) as { role?: string } | undefined;
  return Boolean(row && ["owner", "admin"].includes(row.role || ""));
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  ensureSeed();
  const user = requireAuth(req);
  if (!user) return fail("请先登录", 401, "UNAUTHORIZED");
  const { id } = await params;
  if (!canManage(id, user.id)) return fail("没有组织管理权限", 403, "FORBIDDEN");
  const members = getDB().prepare(`SELECT u.id AS userId, u.username, u.display_name AS displayName, u.email, om.role
    FROM organization_members om JOIN users u ON u.id = om.user_id WHERE om.organization_id = ? ORDER BY om.created_at`).all(id);
  return ok(members);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  ensureSeed();
  const user = requireAuth(req);
  if (!user) return fail("请先登录", 401, "UNAUTHORIZED");
  const { id } = await params;
  if (!canManage(id, user.id)) return fail("没有组织管理权限", 403, "FORBIDDEN");
  const body = await parseBody<{ account?: string; role?: "admin" | "member" | "viewer" }>(req);
  const account = body.account?.trim();
  const role = ["admin", "member", "viewer"].includes(body.role || "") ? body.role! : "member";
  if (!account) return fail("请输入用户名或邮箱", 422);
  const db = getDB();
  const target = db.prepare("SELECT id FROM users WHERE lower(username) = lower(?) OR lower(email) = lower(?)").get(account, account) as { id: string } | undefined;
  if (!target) return fail("账号不存在", 404);
  db.prepare(`INSERT INTO organization_members (organization_id, user_id, role, created_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(organization_id, user_id) DO UPDATE SET role = excluded.role`).run(id, target.id, role, new Date().toISOString());
  writeAudit({ userId: user.id, action: "organization.member.upsert", resourceType: "organization_member", resourceId: target.id, metadata: { organizationId: id, role } });
  return ok({ userId: target.id, role });
}
