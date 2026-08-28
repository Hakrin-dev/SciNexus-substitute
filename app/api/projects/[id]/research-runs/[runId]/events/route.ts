import { NextRequest } from "next/server";
import { getDB } from "@/lib/server/db";
import { requireAuth } from "@/lib/server/auth";
import { assertProjectOwner } from "@/lib/server/workbench";
import { ensureSeed, fail, ok } from "@/lib/server/utils";
import { findOwnedRun, mapEvent } from "@/lib/server/research-runs";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; runId: string }> }) {
  ensureSeed();
  const { id, runId } = await params;
  const user = requireAuth(req);
  if (!user) return fail("请先登录", 401, "UNAUTHORIZED");
  if (!assertProjectOwner(id, user.id)) return fail("项目不存在", 404);
  if (!findOwnedRun(id, runId)) return fail("研究任务不存在", 404, "RUN_NOT_FOUND");
  const after = new URL(req.url).searchParams.get("after");
  const rows = after
    ? getDB().prepare("SELECT * FROM research_run_events WHERE run_id = ? AND created_at > ? ORDER BY created_at ASC LIMIT 500").all(runId, after)
    : getDB().prepare("SELECT * FROM research_run_events WHERE run_id = ? ORDER BY created_at ASC LIMIT 500").all(runId);
  return ok((rows as Record<string, unknown>[]).map(mapEvent));
}
