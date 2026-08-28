import { NextRequest } from "next/server";
import { getDB } from "@/lib/server/db";
import { requireAuth } from "@/lib/server/auth";
import { assertProjectOwner } from "@/lib/server/workbench";
import { ensureSeed, fail, ok, parseBody } from "@/lib/server/utils";
import { appendRunEvent, findOwnedRun, mapExperiment, nowIso } from "@/lib/server/research-runs";

export const runtime = "nodejs";
const STATUSES = ["planned", "running", "passed", "failed", "cancelled"];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; runId: string; experimentId: string }> }) {
  ensureSeed();
  const { id, runId, experimentId } = await params;
  const user = requireAuth(req);
  if (!user) return fail("请先登录", 401, "UNAUTHORIZED");
  if (!assertProjectOwner(id, user.id)) return fail("项目不存在", 404);
  if (!findOwnedRun(id, runId)) return fail("研究任务不存在", 404, "RUN_NOT_FOUND");
  const db = getDB();
  const existing = db.prepare("SELECT * FROM research_experiments WHERE id = ? AND run_id = ?").get(experimentId, runId) as Record<string, unknown> | undefined;
  if (!existing) return fail("实验不存在", 404, "EXPERIMENT_NOT_FOUND");
  try {
    const body = await parseBody<{ status?: string; metrics?: unknown; stdout?: string; stderr?: string; codeRef?: string }>(req);
    if (body.status && !STATUSES.includes(body.status)) return fail("实验状态不合法", 422, "INVALID_EXPERIMENT_STATUS");
    const next = {
      status: body.status || String(existing.status), metrics: body.metrics === undefined ? String(existing.metrics_json) : JSON.stringify(body.metrics),
      stdout: body.stdout === undefined ? String(existing.stdout || "") : body.stdout,
      stderr: body.stderr === undefined ? String(existing.stderr || "") : body.stderr,
      codeRef: body.codeRef === undefined ? existing.code_ref : body.codeRef,
    };
    const at = nowIso();
    db.transaction(() => {
      db.prepare("UPDATE research_experiments SET status = ?, metrics_json = ?, stdout = ?, stderr = ?, code_ref = ?, updated_at = ? WHERE id = ?")
        .run(next.status, next.metrics, next.stdout, next.stderr, next.codeRef, at, experimentId);
      appendRunEvent(db, { runId, projectId: id, kind: "log", message: `实验状态更新为 ${next.status}`, payload: { experimentId } });
    })();
    return ok(mapExperiment(db.prepare("SELECT * FROM research_experiments WHERE id = ?").get(experimentId) as Record<string, unknown>));
  } catch (error) {
    return fail(error instanceof Error ? error.message : "更新实验失败");
  }
}
