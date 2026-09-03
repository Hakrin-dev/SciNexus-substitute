/**
 * POST /api/auth/register
 * 用户注册
 * Body: { username, password, email?, displayName? }
 */
import { NextRequest } from "next/server";
import { ensureSeed, fail, ok, parseBody } from "@/lib/server/utils";
import { register } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  ensureSeed();
  try {
    const body = await parseBody<{
      username: string;
      password: string;
      email?: string;
      displayName?: string;
    }>(req);
    const username = body.username?.trim();
    if (!username || username.length < 2 || username.length > 40 || !/^[\p{L}\p{N}_.-]+$/u.test(username)) {
      return fail("用户名需为 2-40 个字符，仅可包含文字、数字、点、横线和下划线", 422, "INVALID_USERNAME");
    }
    if (!body.password || body.password.length < 6 || body.password.length > 12) {
      return fail("密码需为 6-12 位", 422, "INVALID_PASSWORD");
    }
    if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
      return fail("邮箱格式不正确", 422, "INVALID_EMAIL");
    }
    const result = register({ ...body, username });
    if ("error" in result) {
      return fail(result.error);
    }
    const response = ok({ user: result.user });
    response.cookies.set("yanshu_session", result.token, {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
      path: "/", maxAge: 7 * 24 * 60 * 60,
    });
    return response;
  } catch (e: any) {
    return fail(e.message || "注册失败");
  }
}
