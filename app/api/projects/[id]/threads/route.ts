/**
 * GET  /api/projects/[id]/threads - 研究线程列表
 * POST /api/projects/[id]/threads - 新建研究线程(每个研究问题对应一条)
 */
import { NextRequest } from "next/server";
import { ensureSeed, fail, ok, parseBody, genId } from "@/lib/server/utils";
import { getDB } from "@/lib/server/db";
import { requireAuth } from "@/lib/server/auth";
import { assertProjectOwner, logActivity, mapThread } from "@/lib/server/workbench";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  ensureSeed();
  const { id } = await params;
  try {
    const user = requireAuth(req);
    if (!user) return fail("请先登录", 401, "UNAUTHORIZED");
    if (!assertProjectOwner(id, user.id)) return fail("项目不存在", 404);

    const rows = getDB()
      .prepare("SELECT * FROM wb_threads WHERE project_id = ?")
      .all(id) as unknown as Record<string, unknown>[];
    return ok(rows.map(mapThread));
  } catch (e) {
    return fail(e instanceof Error ? e.message : "获取线程失败");
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  ensureSeed();
  const { id } = await params;
  try {
    const user = requireAuth(req);
    if (!user) return fail("请先登录", 401, "UNAUTHORIZED");
    if (!assertProjectOwner(id, user.id)) return fail("项目不存在", 404);

    const body = await parseBody<{
      questionId?: string | null;
      title?: string;
      stage?: string;
    }>(req);
    if (!body.title || !body.title.trim()) return fail("线程标题不能为空");

    const db = getDB();
    // 线程与问题节点一一对应;若指定问题节点须属于本项目大纲
    let questionNodeId: string | null = null;
    if (body.questionId) {
      const node = db
        .prepare("SELECT 1 FROM wb_outline_nodes WHERE id = ? AND project_id = ?")
        .get(body.questionId, id);
      if (!node) return fail("问题节点不存在", 404);
      questionNodeId = body.questionId;
    }

    const threadId = genId("thread_");
    db.prepare(
      `INSERT INTO wb_threads (id, project_id, question_node_id, title, stage)
       VALUES (?, ?, ?, ?, ?)`
    ).run(threadId, id, questionNodeId, body.title.trim(), body.stage ?? "探索");

    logActivity(db, {
      projectId: id,
      type: "task",
      text: `新建研究线程「${body.title.trim()}」。`,
      threadId,
    });

    const row = db
      .prepare("SELECT * FROM wb_threads WHERE id = ?")
      .get(threadId) as Record<string, unknown>;
    return ok(mapThread(row));
  } catch (e) {
    return fail(e instanceof Error ? e.message : "新建线程失败");
  }
}
