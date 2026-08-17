/**
 * GET /api/auth/me
 * 获取当前登录用户信息
 */
import { NextRequest } from "next/server";
import { ensureSeed, fail, ok } from "@/lib/server/utils";
import { getCurrentUser } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  ensureSeed();
  const user = getCurrentUser(req);
  if (!user) {
    return fail("未登录", 401, "UNAUTHORIZED");
  }
  return ok(user);
}
