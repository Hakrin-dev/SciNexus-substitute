import { NextRequest } from "next/server";
import { getDB } from "@/lib/server/db";
import { getCurrentUser, requireAuth } from "@/lib/server/auth";
import { canAccessProject, writeAudit } from "@/lib/server/workbench";
import { ensureSeed, fail, genId, ok, parseBody } from "@/lib/server/utils";
import { appendRunEvent, mapRun, nowIso, researchExecutor } from "@/lib/server/research-runs";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  ensureSeed();
  const { id } = await params;
  if (!canAccessProject(id, getCurrentUser(req)?.id, "read")) return fail("项目不存在", 404);
  const rows = getDB().prepare("SELECT * FROM research_runs WHERE project_id = ? ORDER BY created_at DESC").all(id) as Record<string, unknown>[];
  return ok(rows.map(mapRun));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  ensureSeed();
  const { id } = await params;
  const user = requireAuth(req);
  if (!user) return fail("请先登录", 401, "UNAUTHORIZED");
  if (!canAccessProject(id, user.id, "write")) return fail("没有项目编辑权限", 403, "FORBIDDEN");
  try {
    const body = await parseBody<{ objective?: string; config?: Record<string, unknown> }>(req);
    const objective = body.objective?.trim();
    if (!objective) return fail("研究目标不能为空", 422, "INVALID_OBJECTIVE");
    if (objective.length > 4000) return fail("研究目标不能超过 4000 字", 422, "INVALID_OBJECTIVE");
    const db = getDB();
    const activeCount = Number((db.prepare("SELECT COUNT(*) AS n FROM research_runs WHERE project_id = ? AND status IN ('queued','running','paused')").get(id) as { n: number }).n);
    if (activeCount >= 2) return fail("同一项目最多同时存在 2 个活动研究任务", 429, "RUN_LIMIT_REACHED");
    const dailyCount = Number((db.prepare("SELECT COUNT(*) AS n FROM research_runs WHERE created_by_user_id = ? AND created_at >= datetime('now', '-1 day')").get(user.id) as { n: number }).n);
    if (dailyCount >= 20) return fail("已达到每日 20 次自动研究上限", 429, "DAILY_LIMIT_REACHED");
    const requested = body.config || {};
    const config = {
      ...requested,
      max_papers: Math.min(50, Math.max(1, Number(requested.max_papers) || 12)),
      llm_max_workers: Math.min(8, Math.max(1, Number(requested.llm_max_workers) || 3)),
      experiment_timeout_sec: Math.min(1800, Math.max(30, Number(requested.experiment_timeout_sec) || 120)),
    };
    const runId = genId("run_");
    const at = nowIso();
    const tx = db.transaction(() => {
      db.prepare(`INSERT INTO research_runs
        (id, project_id, created_by_user_id, objective, status, phase, engine_stage, progress, executor, config_json, budget_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'queued', 'plan', 'plan', 0, ?, ?, ?, ?, ?)`)
        .run(runId, id, user.id, objective, researchExecutor.name, JSON.stringify(config),
          JSON.stringify({ maxAttempts: 3, maxNoProgress: 2 }), at, at);
      appendRunEvent(db, { runId, projectId: id, kind: "status", message: "研究任务已创建，等待执行" });
    });
    tx();
    writeAudit({ userId: user.id, projectId: id, action: "research_run.create", resourceType: "research_run", resourceId: runId });
    const dispatch = await researchExecutor.start(runId);
    const row = getDB().prepare("SELECT * FROM research_runs WHERE id = ?").get(runId) as Record<string, unknown>;
    return ok({ run: mapRun(row), dispatch }, { status: 201 });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "创建研究任务失败");
  }
}
