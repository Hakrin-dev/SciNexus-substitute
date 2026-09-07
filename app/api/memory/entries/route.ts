/**
 * POST /api/memory/entries - 新增 AI 记忆条目（手动 / agent 自动写入）
 * Body: { fact, scope?: "global"|"project", project_id?, project?, source? }
 */
import { NextRequest } from "next/server";
import { ensureSeed, fail, genId, ok, parseBody } from "@/lib/server/utils";
import { getDB, mapMemoryEntry } from "@/lib/server/db";
import { requireAuth } from "@/lib/server/auth";
import { canAccessProject } from "@/lib/server/workbench";

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
    const setting = db.prepare("SELECT enabled FROM memory_settings WHERE user_id=?").get(user.id) as { enabled: number } | undefined;
    if (!setting?.enabled) return fail("请先开启长期记忆", 409, "MEMORY_DISABLED");
    if (scope === "project" && (!body.project_id || !canAccessProject(body.project_id, user.id, "read"))) return fail("项目不存在", 404);
    if (/(?:password|密码|api[_ -]?key|token|secret|身份证|护照|银行卡|信用卡|\b1[3-9]\d{9}\b)/i.test(fact)) return fail("记忆中不能保存敏感凭据或个人标识", 422);
    const id = genId("mem_");
    db.prepare(
      `INSERT INTO memory_entries (id, user_id, fact, scope, project_id, project, source)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, user.id, fact, scope, body.project_id ?? null, body.project ?? null, source);

    const row = db.prepare("SELECT * FROM memory_entries WHERE id = ?").get(id) as Record<string, unknown>;
    return ok(mapMemoryEntry(row));
  } catch (error: unknown) {
    return fail(error instanceof Error ? error.message : "新增记忆失败");
  }
}
