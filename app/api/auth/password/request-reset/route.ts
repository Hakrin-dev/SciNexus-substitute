/**
 * POST /api/auth/password/request-reset
 * 申请密码重置：向用户邮箱发送含重置 token 的链接
 * Body: { email: string }
 *
 * 为避免邮箱枚举，无论邮箱是否注册均返回成功提示。
 */
import { NextRequest } from "next/server";
import { ensureSeed, fail, ok, parseBody } from "@/lib/server/utils";
import { allowRequest } from "@/lib/server/rate-limit";
import { getDB } from "@/lib/server/db";
import {
  generateTicket,
  hashTicket,
  normalizeEmail,
  passwordResetExpiresAt,
} from "@/lib/server/email-otp";
import { getEmailProvider, isEmailDeliveryConfigured } from "@/lib/server/email/provider";
import { passwordResetEmail } from "@/lib/server/email/templates";
import { EMAIL_PROVIDER_NOT_CONFIGURED_CODE } from "@/lib/server/email/provider";
import {
  extractTurnstileToken,
  getClientIP,
  isTurnstileEnabled,
  verifyTurnstileToken,
} from "@/lib/server/captcha/turnstile";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  ensureSeed();

  // 速率限制：每 IP 每小时最多 5 次
  if (!allowRequest(req, "password-request-reset", 5, 60 * 60_000)) {
    return fail("请求过于频繁，请稍后再试", 429, "RATE_LIMITED");
  }

  try {
    // Turnstile 人机验证（已启用时生效）
    if (isTurnstileEnabled()) {
      const token = extractTurnstileToken(req);
      const passed = await verifyTurnstileToken(token, getClientIP(req));
      if (!passed) {
        return fail("人机验证未通过，请重试", 400, "CAPTCHA_FAILED");
      }
    }

    const body = await parseBody<{ email: string }>(req);
    const email = normalizeEmail(body.email || "");

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return fail("邮箱格式不正确", 422, "INVALID_EMAIL");
    }

    // 邮件服务未配置时直接报错（生产环境）
    if (!isEmailDeliveryConfigured() && process.env.NODE_ENV === "production") {
      return fail(
        "邮件服务尚未配置，暂时无法发送重置邮件",
        503,
        EMAIL_PROVIDER_NOT_CONFIGURED_CODE,
      );
    }

    const db = getDB();
    const user = db
      .prepare("SELECT id FROM users WHERE email = ?")
      .get(email) as { id: string } | undefined;

    if (user) {
      // 生成重置 token（明文仅通过邮件链接传递，DB 存哈希）
      const token = generateTicket();
      const tokenHash = hashTicket(token);
      const expiresAt = passwordResetExpiresAt();

      // 清除该用户的旧重置 token
      db.prepare("DELETE FROM password_reset_tokens WHERE user_id = ?").run(user.id);

      db.prepare(
        `INSERT INTO password_reset_tokens (token_hash, user_id, expires_at, used)
         VALUES (?, ?, ?, 0)`,
      ).run(tokenHash, user.id, expiresAt);

      // 发送重置邮件
      const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/reset-password?token=${token}`;
      const { subject, htmlBody } = passwordResetEmail(resetUrl);
      await getEmailProvider().send({ to: email, subject, htmlBody });
    }

    // 无论是否找到用户，均返回成功（防邮箱枚举）
    return ok({ success: true });
  } catch (error: unknown) {
    return fail(error instanceof Error ? error.message : "操作失败");
  }
}
