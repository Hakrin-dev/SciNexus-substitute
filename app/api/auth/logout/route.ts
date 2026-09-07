/**
 * POST /api/auth/logout
 * 用户登出：使当前用户所有已签发 token 失效
 */
import { NextRequest } from "next/server";
import { ensureSeed, ok } from "@/lib/server/utils";
import { getCurrentUser, revokeAllTokens } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  ensureSeed();
  const user = getCurrentUser(req);
  if (user) {
    revokeAllTokens(user.id);
  }
  const response = ok({ logged_out: true });
  response.cookies.set("yanshu_session", "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
  return response;
}
