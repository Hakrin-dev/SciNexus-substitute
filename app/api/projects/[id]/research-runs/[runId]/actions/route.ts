import { NextRequest } from "next/server";
import { getDB } from "@/lib/server/db";
import { requireAuth } from "@/lib/server/auth";
import { canAccessProject, writeAudit } from "@/lib/server/workbench";
import { ensureSeed, fail, ok, parseBody } from "@/lib/server/utils";
import { appendRunEvent, findOwnedRun, mapRun, nowIso, researchExecutor } from "@/lib/server/research-runs";

export const runtime = "nodejs";
type Action = "pause" | "resume" | "cancel";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; runId: string }> }) {
  ensureSeed();
  const { id, runId } = await params;
  const user = requireAuth(req);
  if (!user) return fail("请先登录", 401, "UNAUTHORIZED");
  if (!canAccessProject(id, user.id, "write")) return fail("没有项目编辑权限", 403, "FORBIDDEN");
  const row = findOwnedRun(id, runId);
  if (!row) return fail("研究任务不存在", 404, "RUN_NOT_FOUND");
  try {
    const { action } = await parseBody<{ action?: Action }>(req);
    const current = String(row.status);
    const allowed: Record<Action, string[]> = { pause: ["queued", "running"], resume: ["paused"], cancel: ["queued", "running", "paused"] };
    if (!action || !(action in allowed)) return fail("不支持的操作", 422, "INVALID_ACTION");
    if (!allowed[action].includes(current)) return fail(`当前状态 ${current} 不能执行 ${action}`, 409, "INVALID_TRANSITION");
    if (action === "pause") await researchExecutor.pause(runId);
    if (action === "resume") await researchExecutor.resume(runId);
    if (action === "cancel") await researchExecutor.cancel(runId);
    // pause/cancel 是协作式控制请求：worker 会在下一安全检查点确认最终状态。
    const cooperative = current === "running" && action !== "resume";
    const status = action === "resume"
      ? "queued"
      : cooperative
        ? current
        : action === "pause"
          ? "paused"
          : "cancelled";
    const control = cooperative ? action : null;
    const at = nowIso();
    const db = getDB();
    db.transaction(() => {
      db.prepare("UPDATE research_runs SET status = ?, control_requested = ?, updated_at = ?, finished_at = CASE WHEN ? = 'cancelled' THEN ? ELSE finished_at END WHERE id = ?")
        .run(status, control, at, status, at, runId);
      appendRunEvent(db, { runId, projectId: id, kind: "status", message: action === "resume" ? "研究任务已重新入队" : cooperative ? `已请求${action === "pause" ? "暂停" : "取消"}，将在安全检查点生效` : `研究任务已${status === "paused" ? "暂停" : "取消"}`, payload: { action, from: current, to: status } });
    })();
    writeAudit({ userId: user.id, projectId: id, action: `research_run.${action}`, resourceType: "research_run", resourceId: runId });
    return ok(mapRun(findOwnedRun(id, runId)!));
  } catch (error) {
    return fail(error instanceof Error ? error.message : "更新研究任务失败");
  }
}
