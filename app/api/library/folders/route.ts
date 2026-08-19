/**
 * GET  /api/library/folders  - 获取知识库文件夹列表
 * POST /api/library/folders  - 新建文件夹
 */
import { NextRequest } from "next/server";
import { ensureSeed, fail, ok, parseBody } from "@/lib/server/utils";
import { getDB } from "@/lib/server/db";
import { requireAuth } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  ensureSeed();
  try {
    const user = requireAuth(req);
    if (!user) return fail("请先登录", 401, "UNAUTHORIZED");
    const userId = user.id;
    const db = getDB();
    const rows = db
      .prepare("SELECT * FROM library_folders WHERE user_id = ? ORDER BY id ASC")
      .all(userId) as any[];
    return ok(
      rows.map((r) => ({
        name: r.name,
        count: r.count,
        active: !!r.active,
      }))
    );
  } catch (e: any) {
    return fail(e.message || "获取文件夹失败");
  }
}

export async function POST(req: NextRequest) {
  ensureSeed();
  try {
    const user = requireAuth(req);
    if (!user) return fail("请先登录", 401, "UNAUTHORIZED");
    const userId = user.id;
    const body = await parseBody<{ name: string }>(req);
    if (!body.name?.trim()) return fail("文件夹名称不能为空");
    const db = getDB();
    db.prepare(
      `INSERT OR IGNORE INTO library_folders (user_id, name, count, active) VALUES (?, ?, 0, 0)`
    ).run(userId, body.name.trim());
    return ok({ name: body.name.trim() });
  } catch (e: any) {
    return fail(e.message || "创建文件夹失败");
  }
}
