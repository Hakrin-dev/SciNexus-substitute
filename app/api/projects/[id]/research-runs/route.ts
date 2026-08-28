import { NextRequest } from "next/server";
import { getDB } from "@/lib/server/db";
import { requireAuth } from "@/lib/server/auth";
import { assertProjectOwner } from "@/lib/server/workbench";
import { ensureSeed, fail, genId, ok, parseBody } from "@/lib/server/utils";
import { appendRunEvent, mapRun, nowIso, researchExecutor } from "@/lib/server/research-runs";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  ensureSeed();
  const { id } = await params;
  const user = requireAuth(req);
  if (!user) return fail("请先登录", 401, "UNAUTHORIZED");
  if (!assertProjectOwner(id, user.id)) return fail("项目不存在", 404);
  const rows = getDB().prepare("SELECT * FROM research_runs WHERE project_id = ? ORDER BY created_at DESC").all(id) as Record<string, unknown>[];
  return ok(rows.map(mapRun));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  ensureSeed();
  const { id } = await params;
  const user = requireAuth(req);
  if (!user) return fail("请先登录", 401, "UNAUTHORIZED");
  if (!assertProjectOwner(id, user.id)) return fail("项目不存在", 404);
  try {
    const body = await parseBody<{ objective?: string }>(req);
    const objective = body.objective?.trim();
    if (!objective) return fail("研究目标不能为空", 422, "INVALID_OBJECTIVE");
    if (objective.length > 4000) return fail("研究目标不能超过 4000 字", 422, "INVALID_OBJECTIVE");
    const db = getDB();
    const runId = genId("run_");
    const at = nowIso();
    const tx = db.transaction(() => {
      db.prepare(`INSERT INTO research_runs
        (id, project_id, objective, status, phase, progress, executor, created_at, updated_at)
        VALUES (?, ?, ?, 'queued', 'plan', 0, ?, ?, ?)`)
        .run(runId, id, objective, researchExecutor.name, at, at);
      appendRunEvent(db, { runId, projectId: id, kind: "status", message: "研究任务已创建，等待执行" });
    });
    tx();
    const dispatch = await researchExecutor.start(runId);
    const row = getDB().prepare("SELECT * FROM research_runs WHERE id = ?").get(runId) as Record<string, unknown>;
    return ok({ run: mapRun(row), dispatch }, { status: 201 });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "创建研究任务失败");
  }
}
