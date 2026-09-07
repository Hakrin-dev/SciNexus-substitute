/**
 * POST /api/auth/login
 * 用户登录
 * Body: { username: string, password: string }
 */
import { NextRequest } from "next/server";
import { ensureSeed, fail, ok, parseBody } from "@/lib/server/utils";
import { login } from "@/lib/server/auth";
import { allowRequest } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  ensureSeed();
  if (!allowRequest(req, "auth-login", 10, 15 * 60_000)) return fail("尝试次数过多，请稍后再试", 429, "RATE_LIMITED");
  try {
    const body = await parseBody<{ username: string; password: string }>(req);
    if (!body.username || !body.password) {
      return fail("用户名和密码不能为空");
    }
    const result = login(body.username.trim(), body.password);
    if (!result) {
      return fail("用户名或密码错误", 401);
    }
    const response = ok({ user: result.user });
    response.cookies.set("yanshu_session", result.token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 7 * 24 * 60 * 60 });
    return response;
  } catch (error: unknown) {
    return fail(error instanceof Error ? error.message : "登录失败");
  }
}
