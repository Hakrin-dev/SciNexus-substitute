import { NextRequest } from "next/server";
import { getDB } from "@/lib/server/db";
import { requireAuth } from "@/lib/server/auth";
import { assertProjectOwner } from "@/lib/server/workbench";
import { ensureSeed, fail, ok, parseBody } from "@/lib/server/utils";
import { appendRunEvent, findOwnedRun, mapRun, nowIso, researchExecutor } from "@/lib/server/research-runs";

export const runtime = "nodejs";
type Action = "pause" | "resume" | "cancel";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; runId: string }> }) {
  ensureSeed();
  const { id, runId } = await params;
  const user = requireAuth(req);
  if (!user) return fail("请先登录", 401, "UNAUTHORIZED");
  if (!assertProjectOwner(id, user.id)) return fail("项目不存在", 404);
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
    const status = action === "pause" ? "paused" : action === "resume" ? "queued" : "cancelled";
    const at = nowIso();
    const db = getDB();
    db.transaction(() => {
      db.prepare("UPDATE research_runs SET status = ?, updated_at = ?, finished_at = CASE WHEN ? = 'cancelled' THEN ? ELSE finished_at END WHERE id = ?")
        .run(status, at, status, at, runId);
      appendRunEvent(db, { runId, projectId: id, kind: "status", message: `研究任务状态变更为 ${status}`, payload: { action, from: current, to: status } });
    })();
    return ok(mapRun(findOwnedRun(id, runId)!));
  } catch (error) {
    return fail(error instanceof Error ? error.message : "更新研究任务失败");
  }
}
