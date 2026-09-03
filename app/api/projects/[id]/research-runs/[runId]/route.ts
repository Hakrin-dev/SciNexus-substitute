import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { canAccessProject } from "@/lib/server/workbench";
import { ensureSeed, fail, ok } from "@/lib/server/utils";
import { findOwnedRun, mapRun } from "@/lib/server/research-runs";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; runId: string }> }) {
  ensureSeed();
  const { id, runId } = await params;
  if (!canAccessProject(id, getCurrentUser(req)?.id, "read")) return fail("项目不存在", 404);
  const row = findOwnedRun(id, runId);
  if (!row) return fail("研究任务不存在", 404, "RUN_NOT_FOUND");
  return ok(mapRun(row));
}
