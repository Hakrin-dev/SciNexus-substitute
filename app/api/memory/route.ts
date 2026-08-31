/**
 * GET /api/memory - AI 长期记忆（条目列表 + 总开关）
 *   查询参数 scope=global|project 可选过滤
 * PUT /api/memory - 设置记忆总开关  Body: { enabled: boolean }
 *
 * 数据落 SQLite(memory_settings / memory_entries)，重启不丢；agent 对话注入与自动写入共用此数据。
 */
import { NextRequest } from "next/server";
import { ensureSeed, fail, ok, parseBody } from "@/lib/server/utils";
import { getDB, mapMemoryEntry } from "@/lib/server/db";
import { requireAuth } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  ensureSeed();
  try {
    const user = requireAuth(req);
    if (!user) return fail("请先登录", 401, "UNAUTHORIZED");

    const scope = new URL(req.url).searchParams.get("scope");
    if (scope && scope !== "global" && scope !== "project") {
      return fail("scope 仅支持 global / project");
    }

    const db = getDB();
    const settings = db
      .prepare("SELECT enabled FROM memory_settings WHERE user_id = ?")
      .get(user.id) as { enabled?: number } | undefined;

    let sql = "SELECT * FROM memory_entries WHERE user_id = ?";
    const params: (string | number)[] = [user.id];
    if (scope) {
      sql += " AND scope = ?";
      params.push(scope);
    }
    sql += " ORDER BY created_at DESC";
    const rows = db.prepare(sql).all(...params) as any[];

    return ok({
      enabled: settings ? !!settings.enabled : true,
      items: rows.map(mapMemoryEntry),
    });
  } catch (e: any) {
    return fail(e.message || "获取记忆失败");
  }
}

export async function PUT(req: NextRequest) {
  ensureSeed();
  try {
    const user = requireAuth(req);
    if (!user) return fail("请先登录", 401, "UNAUTHORIZED");

    const body = await parseBody<{ enabled?: boolean }>(req);
    if (typeof body.enabled !== "boolean") return fail("enabled 必须为布尔值");

    const db = getDB();
    db.prepare(
      `INSERT INTO memory_settings (user_id, enabled) VALUES (?, ?)
       ON CONFLICT(user_id) DO UPDATE SET enabled = excluded.enabled, updated_at = datetime('now', 'localtime')`
    ).run(user.id, body.enabled ? 1 : 0);

    return ok({ enabled: body.enabled });
  } catch (e: any) {
    return fail(e.message || "设置记忆开关失败");
  }
}