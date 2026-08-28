import { NextRequest } from "next/server";
import { getDB } from "@/lib/server/db";
import { requireAuth } from "@/lib/server/auth";
import { assertProjectOwner } from "@/lib/server/workbench";
import { ensureSeed, fail, genId, ok, parseBody } from "@/lib/server/utils";
import { appendRunEvent, findOwnedRun, mapArtifact, nowIso } from "@/lib/server/research-runs";

export const runtime = "nodejs";
const KINDS = ["report", "dataset", "code", "note", "metrics", "log", "other"];

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; runId: string }> }) {
  ensureSeed();
  const { id, runId } = await params;
  const user = requireAuth(req);
  if (!user) return fail("请先登录", 401, "UNAUTHORIZED");
  if (!assertProjectOwner(id, user.id)) return fail("项目不存在", 404);
  if (!findOwnedRun(id, runId)) return fail("研究任务不存在", 404, "RUN_NOT_FOUND");
  const rows = getDB().prepare("SELECT * FROM research_artifacts WHERE run_id = ? ORDER BY created_at DESC").all(runId) as Record<string, unknown>[];
  return ok(rows.map(mapArtifact));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; runId: string }> }) {
  ensureSeed();
  const { id, runId } = await params;
  const user = requireAuth(req);
  if (!user) return fail("请先登录", 401, "UNAUTHORIZED");
  if (!assertProjectOwner(id, user.id)) return fail("项目不存在", 404);
  if (!findOwnedRun(id, runId)) return fail("研究任务不存在", 404, "RUN_NOT_FOUND");
  try {
    const body = await parseBody<{ kind?: string; title?: string; uri?: string; content?: string; metadata?: unknown }>(req);
    const title = body.title?.trim();
    const kind = body.kind || "other";
    if (!title) return fail("产物标题不能为空", 422, "INVALID_ARTIFACT");
    if (!KINDS.includes(kind)) return fail("产物类型不合法", 422, "INVALID_ARTIFACT_KIND");
    if (!body.uri && !body.content) return fail("产物必须包含 uri 或 content", 422, "INVALID_ARTIFACT");
    const artifactId = genId("art_");
    const at = nowIso();
    const db = getDB();
    db.transaction(() => {
      db.prepare(`INSERT INTO research_artifacts
        (id, run_id, project_id, kind, title, uri, content, metadata_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(artifactId, runId, id, kind, title, body.uri || null, body.content || null, JSON.stringify(body.metadata || {}), at);
      appendRunEvent(db, { runId, projectId: id, kind: "log", message: `新增研究产物：${title}`, payload: { artifactId, kind } });
    })();
    return ok(mapArtifact(db.prepare("SELECT * FROM research_artifacts WHERE id = ?").get(artifactId) as Record<string, unknown>), { status: 201 });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "登记研究产物失败");
  }
}
