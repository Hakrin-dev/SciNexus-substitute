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
    if (!body.username || body.username.length < 2) {
      return fail("用户名至少 2 个字符");
    }
    if (!body.password || body.password.length < 6) {
      return fail("密码至少 6 位");
    }
    const result = register(body);
    if ("error" in result) {
      return fail(result.error);
    }
    return ok(result);
  } catch (e: any) {
    return fail(e.message || "注册失败");
  }
}
