/**
 * POST /api/auth/login
 * 用户登录
 * Body: { username: string, password: string }
 */
import { NextRequest } from "next/server";
import { ensureSeed, fail, ok, parseBody } from "@/lib/server/utils";
import { login } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  ensureSeed();
  try {
    const body = await parseBody<{ username: string; password: string }>(req);
    if (!body.username || !body.password) {
      return fail("用户名和密码不能为空");
    }
    const result = login(body.username.trim(), body.password);
    if (!result) {
      return fail("用户名或密码错误", 401);
    }
    return ok(result);
  } catch (e: any) {
    return fail(e.message || "登录失败");
  }
}
