import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { getDB } from "@/lib/server/db";
import { ensureSeed, fail, ok, parseBody } from "@/lib/server/utils";
import { canAccessProject, writeAudit } from "@/lib/server/workbench";
import { launchMockWorker, mapRun, nowIso } from "@/lib/server/research-runs";

type RunControlRow = { status: string };
type RunAction = "pause" | "resume" | "cancel";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; runId: string }> }) {
  ensureSeed();
  const user = requireAuth(req);
  const { id, runId } = await params;
  if (!user) return fail("请先登录", 401);
  if (!canAccessProject(id, user.id, "write")) return fail("没有控制研究权限", 403);
  const body = await parseBody<{ action?: RunAction }>(req);
  const db = getDB();
  const run = db.prepare("SELECT status FROM research_runs WHERE id=? AND project_id=?").get(runId, id) as RunControlRow | undefined;
  if (!run) return fail("运行不存在", 404);

  if (body.action === "resume" && run.status === "paused") {
    db.prepare("UPDATE research_runs SET status='queued',control_requested=NULL,updated_at=? WHERE id=?").run(nowIso(), runId);
    launchMockWorker(runId);
  } else if (body.action === "pause" && ["queued", "running"].includes(run.status)) {
    db.prepare("UPDATE research_runs SET control_requested='pause',updated_at=? WHERE id=?").run(nowIso(), runId);
  } else if (body.action === "cancel" && ["queued", "running", "paused"].includes(run.status)) {
    db.prepare("UPDATE research_runs SET control_requested='cancel',updated_at=? WHERE id=?").run(nowIso(), runId);
  } else {
    return fail("当前状态不支持该操作", 409);
  }
  writeAudit({ userId: user.id, projectId: id, action: `research.${body.action}`, resourceType: "research_run", resourceId: runId });
  return ok(mapRun(db.prepare("SELECT * FROM research_runs WHERE id=?").get(runId)));
}
