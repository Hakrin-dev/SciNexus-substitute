/**
 * POST /api/auth/password/reset
 * 重置密码：校验 token，设置新密码
 * Body: { token: string, newPassword: string }
 */
import { NextRequest } from "next/server";
import { ensureSeed, fail, ok, parseBody } from "@/lib/server/utils";
import { allowRequest } from "@/lib/server/rate-limit";
import { getDB } from "@/lib/server/db";
import { hashTicket } from "@/lib/server/email-otp";
import { updatePassword } from "@/lib/server/auth";
import {
  validatePasswordPolicy,
  PASSWORD_POLICY_MESSAGE,
} from "@/lib/server/password-policy";

export const runtime = "nodejs";

interface TokenRow {
  user_id: string;
  expires_at: string;
  used: number;
}

export async function POST(req: NextRequest) {
  ensureSeed();

  // 速率限制：每 IP 每 15 分钟最多 10 次
  if (!allowRequest(req, "password-reset", 10, 15 * 60_000)) {
    return fail("请求过于频繁，请稍后再试", 429, "RATE_LIMITED");
  }

  try {
    const body = await parseBody<{ token: string; newPassword: string }>(req);
    const token = (body.token || "").trim();
    const newPassword = body.newPassword || "";

    if (!token) {
      return fail("重置链接无效，请重新申请", 400, "INVALID_TOKEN");
    }

    // 密码策略校验
    if (!validatePasswordPolicy(newPassword).valid) {
      return fail(PASSWORD_POLICY_MESSAGE, 422, "PASSWORD_POLICY_VIOLATION");
    }

    const db = getDB();
    const tokenHash = hashTicket(token);
    const result = db.transaction(() => {
      const row = db
        .prepare(
          "SELECT user_id, expires_at, used FROM password_reset_tokens WHERE token_hash = ?",
        )
        .get(tokenHash) as TokenRow | undefined;

      if (!row || row.used === 1) return { status: "invalid" as const };
      if (new Date(row.expires_at).getTime() < Date.now()) {
        db.prepare("DELETE FROM password_reset_tokens WHERE token_hash = ?").run(tokenHash);
        return { status: "expired" as const };
      }

      // 先在事务内原子消费 token，再更新密码；并发请求中只有一个能继续。
      const consumed = db
        .prepare(
          "UPDATE password_reset_tokens SET used = 1 WHERE token_hash = ? AND used = 0",
        )
        .run(tokenHash);
      if (consumed.changes !== 1) return { status: "invalid" as const };

      updatePassword(row.user_id, newPassword);
      return { status: "ok" as const };
    })();

    if (result.status === "invalid") {
      return fail("重置链接已失效，请重新申请", 400, "INVALID_TOKEN");
    }
    if (result.status === "expired") {
      return fail("重置链接已过期，请重新申请", 400, "TOKEN_EXPIRED");
    }

    return ok({ success: true });
  } catch (error: unknown) {
    return fail(error instanceof Error ? error.message : "重置密码失败");
  }
}
