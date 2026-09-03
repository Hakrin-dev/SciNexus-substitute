import { NextRequest } from "next/server";
import { getDB } from "@/lib/server/db";
import { getCurrentUser, requireAuth } from "@/lib/server/auth";
import { ensureSeed, fail, ok, parseBody } from "@/lib/server/utils";
import { genId } from "@/lib/server/utils";
import { writeAudit } from "@/lib/server/workbench";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  ensureSeed();
  const user = getCurrentUser(req);
  if (!user) return fail("请先登录", 401, "UNAUTHORIZED");
  const rows = getDB().prepare(`SELECT o.id, o.name, o.slug, om.role, o.created_at AS createdAt
    FROM organizations o JOIN organization_members om ON om.organization_id = o.id
    WHERE om.user_id = ? ORDER BY o.created_at DESC`).all(user.id);
  return ok(rows);
}

export async function POST(req: NextRequest) {
  ensureSeed();
  const user = requireAuth(req);
  if (!user) return fail("请先登录", 401, "UNAUTHORIZED");
  const body = await parseBody<{ name?: string; slug?: string }>(req);
  const name = body.name?.trim();
  const slug = (body.slug || name || "").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!name || !slug) return fail("组织名称和有效标识不能为空", 422);
  const db = getDB();
  const id = genId("org_");
  const now = new Date().toISOString();
  try {
    db.transaction(() => {
      db.prepare("INSERT INTO organizations (id, name, slug, owner_user_id, created_at) VALUES (?, ?, ?, ?, ?)").run(id, name, slug, user.id, now);
      db.prepare("INSERT INTO organization_members (organization_id, user_id, role, created_at) VALUES (?, ?, 'owner', ?)").run(id, user.id, now);
    })();
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE")) return fail("组织标识已存在", 409);
    throw error;
  }
  writeAudit({ userId: user.id, action: "organization.create", resourceType: "organization", resourceId: id });
  return ok({ id, name, slug });
}
