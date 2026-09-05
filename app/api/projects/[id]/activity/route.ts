/**
 * GET  /api/projects/[id]/activity - 活动日志(按时间正序,前端自行倒序展示)
 * POST /api/projects/[id]/activity - 手写一条日志(实验记录本备注)
 */
import { NextRequest } from "next/server";
import { ensureSeed, fail, ok, parseBody, genId } from "@/lib/server/utils";
import { getDB } from "@/lib/server/db";
import { requireAuth } from "@/lib/server/auth";
import {
  assertProjectOwner,
  isOneOf,
  nowIso,
  ACTIVITY_TYPES,
} from "@/lib/server/workbench";

export const runtime = "nodejs";

type Row = Record<string, unknown>;

function mapEntry(r: Row) {
  const entry: Record<string, unknown> = {
    id: String(r.id),
    at: String(r.created_at || ""),
    actor: String(r.actor),
    type: String(r.type),
    text: String(r.text || ""),
  };
  if (r.thread_id) entry.threadId = String(r.thread_id);
  return entry;
}

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
      .prepare(
        "SELECT * FROM wb_activity_log WHERE project_id = ? ORDER BY created_at ASC"
      )
      .all(id) as unknown as Row[];
    return ok(rows.map(mapEntry));
  } catch (e) {
    return fail(e instanceof Error ? e.message : "获取活动日志失败");
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
      text?: string;
      type?: string;
      threadId?: string | null;
    }>(req);
    if (!body.text || !body.text.trim()) return fail("日志内容不能为空");
    const type = body.type ?? "note";
    if (!isOneOf(type, ACTIVITY_TYPES)) return fail("日志类型非法");

    // 若指定线程须属于本项目
    let threadId: string | null = null;
    if (body.threadId) {
      const t = getDB()
        .prepare("SELECT 1 FROM wb_threads WHERE id = ? AND project_id = ?")
        .get(body.threadId, id);
      if (!t) return fail("关联线程不存在", 404);
      threadId = body.threadId;
    }

    const db = getDB();
    const entryId = genId("log_");
    const at = nowIso();
    db.prepare(
      `INSERT INTO wb_activity_log (id, project_id, actor, type, text, thread_id, created_at)
       VALUES (?, ?, 'user', ?, ?, ?, ?)`
    ).run(entryId, id, type, body.text.trim(), threadId, at);

    return ok(mapEntry(db.prepare("SELECT * FROM wb_activity_log WHERE id = ?").get(entryId) as Row));
  } catch (e) {
    return fail(e instanceof Error ? e.message : "新增日志失败");
  }
}
