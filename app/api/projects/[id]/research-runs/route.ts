import { NextRequest } from "next/server";
import { getCurrentUser, requireAuth } from "@/lib/server/auth";
import { getDB } from "@/lib/server/db";
import { ensureSeed, fail, genId, ok, parseBody } from "@/lib/server/utils";
import { canAccessProject, writeAudit } from "@/lib/server/workbench";
import { appendEvent, launchMockWorker, mapRun, nowIso } from "@/lib/server/research-runs";

export const runtime = "nodejs";

const PROFILES = new Set(["fast", "standard", "deep"]);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  ensureSeed();
  const user = getCurrentUser(req);
  const { id } = await params;
  if (!canAccessProject(id, user?.id, "read")) return fail("项目不存在", 404);
  const rows = getDB()
    .prepare("SELECT * FROM research_runs WHERE project_id=? ORDER BY created_at DESC")
    .all(id);
  return ok(rows.map(mapRun));
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  ensureSeed();
  const user = requireAuth(req);
  const { id } = await params;
  if (!user) return fail("请先登录", 401, "UNAUTHORIZED");
  if (!canAccessProject(id, user.id, "write")) return fail("没有启动研究权限", 403, "FORBIDDEN");

  const body = await parseBody<{ objective?: string; config?: Record<string, unknown> }>(req);
  const objective = body.objective?.trim();
  if (!objective) return fail("研究目标不能为空", 422);
  if (objective.length > 1000) return fail("研究目标不能超过 1000 字", 422);

  const db = getDB();
  const active = db.prepare(
    "SELECT id FROM research_runs WHERE project_id=? AND status IN ('queued','running','paused') ORDER BY created_at DESC LIMIT 1",
  ).get(id) as { id: string } | undefined;
  if (active) return fail("当前项目已有未结束的自动研究，请先完成或取消该任务", 409, "RESEARCH_RUN_ACTIVE");

  const requestedProfile = String(body.config?.research_profile ?? "standard");
  const profile = PROFILES.has(requestedProfile) ? requestedProfile : "standard";
  const config = {
    research_profile: profile,
    max_papers: profile === "fast" ? 4 : profile === "deep" ? 24 : 12,
    llm_max_workers: profile === "fast" ? 4 : 3,
    experiment_timeout_sec: profile === "fast" ? 60 : profile === "deep" ? 300 : 120,
    strict_search: profile === "deep",
    execution_mode: "mock",
  };
  const runId = genId("run_");
  const now = nowIso();
  db.prepare(`INSERT INTO research_runs
    (id,project_id,created_by_user_id,objective,status,phase,engine_stage,progress,executor,config_json,created_at,updated_at)
    VALUES (?,?,?,?,'queued','plan','plan',0,'mock',?,?,?)`)
    .run(runId, id, user.id, objective, JSON.stringify(config), now, now);
  appendEvent(db, {
    runId,
    projectId: id,
    kind: "queued",
    message: "研究任务已进入执行队列",
    payload: { executionMode: "mock", profile },
  });
  writeAudit({
    userId: user.id,
    projectId: id,
    action: "research.start",
    resourceType: "research_run",
    resourceId: runId,
    metadata: { profile },
  });
  launchMockWorker(runId);
  return ok({ run: mapRun(db.prepare("SELECT * FROM research_runs WHERE id=?").get(runId)) });
}
