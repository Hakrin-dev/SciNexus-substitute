import { NextRequest } from "next/server";
import { getDB } from "@/lib/server/db";
import { requireAuth } from "@/lib/server/auth";
import { assertProjectOwner } from "@/lib/server/workbench";
import { ensureSeed, fail, genId, ok, parseBody } from "@/lib/server/utils";
import { appendRunEvent, findOwnedRun, nowIso } from "@/lib/server/research-runs";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; runId: string }> }) {
  ensureSeed();
  const { id, runId } = await params;
  const user = requireAuth(req);
  if (!user) return fail("请先登录", 401, "UNAUTHORIZED");
  if (!assertProjectOwner(id, user.id)) return fail("项目不存在", 404);
  if (!findOwnedRun(id, runId)) return fail("研究任务不存在", 404, "RUN_NOT_FOUND");
  const rows = getDB().prepare("SELECT * FROM research_run_instructions WHERE run_id = ? ORDER BY created_at ASC").all(runId) as Record<string, unknown>[];
  return ok(rows.map((row) => ({ id: String(row.id), content: String(row.content), status: String(row.status), createdAt: String(row.created_at) })));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; runId: string }> }) {
  ensureSeed();
  const { id, runId } = await params;
  const user = requireAuth(req);
  if (!user) return fail("请先登录", 401, "UNAUTHORIZED");
  if (!assertProjectOwner(id, user.id)) return fail("项目不存在", 404);
  const run = findOwnedRun(id, runId);
  if (!run) return fail("研究任务不存在", 404, "RUN_NOT_FOUND");
  if (["completed", "failed", "cancelled"].includes(String(run.status))) return fail("已结束的任务不能追加指令", 409, "RUN_FINISHED");
  try {
    const body = await parseBody<{ content?: string }>(req);
    const content = body.content?.trim();
    if (!content) return fail("指令内容不能为空", 422, "INVALID_INSTRUCTION");
    if (content.length > 4000) return fail("指令不能超过 4000 字", 422, "INVALID_INSTRUCTION");
    const instruction = { id: genId("ri_"), content, status: "pending", createdAt: nowIso() };
    const db = getDB();
    db.transaction(() => {
      db.prepare(`INSERT INTO research_run_instructions (id, run_id, project_id, content, status, created_at)
        VALUES (?, ?, ?, ?, 'pending', ?)`).run(instruction.id, runId, id, content, instruction.createdAt);
      appendRunEvent(db, { runId, projectId: id, kind: "instruction", message: "用户追加了研究指令", payload: { instructionId: instruction.id } });
    })();
    return ok(instruction, { status: 201 });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "保存研究指令失败");
  }
}
