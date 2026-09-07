import { NextRequest } from "next/server";
import { getCurrentUser, requireAuth } from "@/lib/server/auth";
import { getDB } from "@/lib/server/db";
import { ensureSeed, fail, genId, ok, parseBody } from "@/lib/server/utils";
import { canAccessProject, writeAudit } from "@/lib/server/workbench";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; runId: string }> }) {
  ensureSeed();
  const { id, runId } = await params;
  if (!canAccessProject(id, getCurrentUser(req)?.id, "read")) return fail("项目不存在", 404);
  return ok(getDB().prepare("SELECT id,content,status,created_at AS createdAt,applied_at AS appliedAt FROM research_run_instructions WHERE project_id=? AND run_id=? ORDER BY created_at").all(id, runId));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; runId: string }> }) {
  ensureSeed();
  const user = requireAuth(req);
  const { id, runId } = await params;
  if (!user) return fail("请先登录", 401, "UNAUTHORIZED");
  if (!canAccessProject(id, user.id, "write")) return fail("没有追加指令权限", 403);
  const run = getDB().prepare("SELECT status FROM research_runs WHERE id=? AND project_id=?").get(runId, id) as { status: string } | undefined;
  if (!run) return fail("运行不存在", 404);
  if (!["queued", "running", "paused"].includes(run.status)) return fail("该运行已经结束", 409);
  const body = await parseBody<{ content?: string }>(req);
  const content = body.content?.trim();
  if (!content || content.length > 2000) return fail("指令长度须为 1–2000 字", 422);
  const instructionId = genId("instruction_");
  const createdAt = new Date().toISOString();
  getDB().prepare("INSERT INTO research_run_instructions (id,run_id,project_id,user_id,content,created_at) VALUES (?,?,?,?,?,?)").run(instructionId, runId, id, user.id, content, createdAt);
  writeAudit({ userId: user.id, projectId: id, action: "research.instruction", resourceType: "research_run", resourceId: runId });
  return ok({ id: instructionId, content, status: "pending", createdAt });
}
