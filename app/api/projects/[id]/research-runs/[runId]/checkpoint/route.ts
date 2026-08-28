import { NextRequest } from "next/server";
import { getDB } from "@/lib/server/db";
import { requireAuth } from "@/lib/server/auth";
import { assertProjectOwner } from "@/lib/server/workbench";
import { ensureSeed, fail, ok, parseBody } from "@/lib/server/utils";
import { appendRunEvent, findOwnedRun, mapRun, nowIso, RESEARCH_PHASES } from "@/lib/server/research-runs";

export const runtime = "nodejs";
const STATUSES = ["queued", "running", "paused", "completed", "failed", "cancelled"];

/**
 * 执行状态回写入口。当前可供平台自身的模拟/人工流程使用；未来接入真实执行器时，
 * 应在网关层增加服务身份认证，再由适配器调用同一领域服务。
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; runId: string }> }) {
  ensureSeed();
  const { id, runId } = await params;
  const user = requireAuth(req);
  if (!user) return fail("请先登录", 401, "UNAUTHORIZED");
  if (!assertProjectOwner(id, user.id)) return fail("项目不存在", 404);
  const existing = findOwnedRun(id, runId);
  if (!existing) return fail("研究任务不存在", 404, "RUN_NOT_FOUND");
  try {
    const body = await parseBody<{ phase?: string; status?: string; progress?: number; message?: string; stopReason?: string; errorMessage?: string }>(req);
    const phase = body.phase || String(existing.phase);
    const status = body.status || String(existing.status);
    const progress = body.progress === undefined ? Number(existing.progress) : Number(body.progress);
    if (!RESEARCH_PHASES.includes(phase as never)) return fail("研究阶段不合法", 422, "INVALID_PHASE");
    if (!STATUSES.includes(status)) return fail("任务状态不合法", 422, "INVALID_STATUS");
    if (!Number.isFinite(progress) || progress < 0 || progress > 100) return fail("进度必须在 0 到 100 之间", 422, "INVALID_PROGRESS");
    const terminal = ["completed", "failed", "cancelled"].includes(status);
    const at = nowIso();
    const db = getDB();
    db.transaction(() => {
      db.prepare(`UPDATE research_runs SET phase = ?, status = ?, progress = ?, stop_reason = ?, error_message = ?,
        started_at = CASE WHEN ? = 'running' AND started_at IS NULL THEN ? ELSE started_at END,
        finished_at = CASE WHEN ? THEN ? ELSE finished_at END, updated_at = ? WHERE id = ?`)
        .run(phase, status, progress, body.stopReason || null, body.errorMessage || null, status, at, terminal ? 1 : 0, at, at, runId);
      appendRunEvent(db, { runId, projectId: id, kind: phase !== existing.phase ? "phase" : "checkpoint",
        level: status === "failed" ? "error" : "info", message: body.message || `研究进度更新：${phase} ${progress}%`,
        payload: { phase, status, progress } });
    })();
    return ok(mapRun(findOwnedRun(id, runId)!));
  } catch (error) {
    return fail(error instanceof Error ? error.message : "更新研究进度失败");
  }
}
