import { NextRequest } from "next/server";
import { getDB } from "@/lib/server/db";
import { getCurrentUser, requireAuth } from "@/lib/server/auth";
import { canAccessProject } from "@/lib/server/workbench";
import { ensureSeed, fail, genId, ok, parseBody } from "@/lib/server/utils";
import { appendRunEvent, findOwnedRun, mapExperiment, nowIso } from "@/lib/server/research-runs";

export const runtime = "nodejs";
const STATUSES = ["planned", "running", "passed", "failed", "cancelled"];

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; runId: string }> }) {
  ensureSeed();
  const { id, runId } = await params;
  if (!canAccessProject(id, getCurrentUser(req)?.id, "read")) return fail("项目不存在", 404);
  if (!findOwnedRun(id, runId)) return fail("研究任务不存在", 404, "RUN_NOT_FOUND");
  const rows = getDB().prepare("SELECT * FROM research_experiments WHERE run_id = ? ORDER BY round, created_at").all(runId) as Record<string, unknown>[];
  return ok(rows.map(mapExperiment));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; runId: string }> }) {
  ensureSeed();
  const { id, runId } = await params;
  const user = requireAuth(req);
  if (!user) return fail("请先登录", 401, "UNAUTHORIZED");
  if (!canAccessProject(id, user.id, "write")) return fail("没有项目编辑权限", 403, "FORBIDDEN");
  if (!findOwnedRun(id, runId)) return fail("研究任务不存在", 404, "RUN_NOT_FOUND");
  try {
    const body = await parseBody<{ title?: string; round?: number; status?: string; hypothesis?: string; metrics?: unknown; stdout?: string; stderr?: string; codeRef?: string }>(req);
    const title = body.title?.trim();
    if (!title) return fail("实验标题不能为空", 422, "INVALID_EXPERIMENT");
    const status = body.status || "planned";
    if (!STATUSES.includes(status)) return fail("实验状态不合法", 422, "INVALID_EXPERIMENT_STATUS");
    const round = Number.isInteger(body.round) && Number(body.round) > 0 ? Number(body.round) : 1;
    const experimentId = genId("exp_");
    const at = nowIso();
    const db = getDB();
    db.transaction(() => {
      db.prepare(`INSERT INTO research_experiments
        (id, run_id, project_id, title, round, status, hypothesis, metrics_json, stdout, stderr, code_ref, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(experimentId, runId, id, title, round, status, body.hypothesis || null, JSON.stringify(body.metrics || {}), body.stdout || "", body.stderr || "", body.codeRef || null, at, at);
      appendRunEvent(db, { runId, projectId: id, kind: "log", message: `登记实验：${title}`, payload: { experimentId, round, status } });
    })();
    const row = db.prepare("SELECT * FROM research_experiments WHERE id = ?").get(experimentId) as Record<string, unknown>;
    return ok(mapExperiment(row), { status: 201 });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "登记实验失败");
  }
}
