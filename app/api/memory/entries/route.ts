/**
 * POST /api/memory/entries - 新增 AI 记忆条目（手动 / agent 自动写入）
 * Body: { fact, scope?: "global"|"project", project_id?, project?, source? }
 */
import { NextRequest } from "next/server";
import { ensureSeed, fail, genId, ok, parseBody } from "@/lib/server/utils";
import { getDB, mapMemoryEntry } from "@/lib/server/db";
import { requireAuth } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  ensureSeed();
  try {
    const user = requireAuth(req);
    if (!user) return fail("请先登录", 401, "UNAUTHORIZED");

    const body = await parseBody<{
      fact?: string;
      scope?: string;
      project_id?: string;
      project?: string;
      source?: string;
    }>(req);
    const fact = (body.fact || "").trim();
    if (!fact) return fail("fact 不能为空");
    const scope = body.scope === "project" ? "project" : "global";
    if (scope === "project" && !body.project_id && !body.project) {
      return fail("项目级记忆需要提供 project_id 或 project");
    }
    const source = (body.source || "手动").trim();

    const db = getDB();
    const id = genId("mem_");
    db.prepare(
      `INSERT INTO memory_entries (id, user_id, fact, scope, project_id, project, source)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, user.id, fact, scope, body.project_id ?? null, body.project ?? null, source);

    const row = db.prepare("SELECT * FROM memory_entries WHERE id = ?").get(id) as any;
    return ok(mapMemoryEntry(row));
  } catch (e: any) {
    return fail(e.message || "新增记忆失败");
  }
}