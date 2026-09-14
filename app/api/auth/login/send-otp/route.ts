/**
 * POST /api/auth/login/send-otp
 * 发送登录邮箱验证码（仅对已注册邮箱发送，未注册邮箱返回成功但不发送，防邮箱枚举）
 * Body: { email: string }
 */
import { NextRequest } from "next/server";
import { ensureSeed, fail, ok, parseBody } from "@/lib/server/utils";
import { allowRequest } from "@/lib/server/rate-limit";
import { getDB } from "@/lib/server/db";
import {
  generateChallengeId,
  generateOtp,
  hashOtp,
  normalizeEmail,
  otpExpiresAt,
} from "@/lib/server/email-otp";
import { getEmailProvider, isEmailDeliveryConfigured } from "@/lib/server/email/provider";
import { loginOtpEmail } from "@/lib/server/email/templates";
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

  // 速率限制：每 IP 每 60 秒最多 3 次
  if (!allowRequest(req, "login-send-otp", 3, 60_000)) {
    return fail("请求过于频繁，请稍后再试", 429, "RATE_LIMITED");
  }

  try {
    // Turnstile 人机验证
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

    if (!isEmailDeliveryConfigured() && process.env.NODE_ENV === "production") {
      return fail(
        "邮件服务尚未配置，暂时无法发送验证码",
        503,
        EMAIL_PROVIDER_NOT_CONFIGURED_CODE,
      );
    }

    const db = getDB();
    const user = db
      .prepare("SELECT id FROM users WHERE email = ?")
      .get(email) as { id: string } | undefined;

    // 始终生成 challengeId（防邮箱枚举：未注册邮箱也返回 challengeId 但不发邮件）
    const challengeId = generateChallengeId();

    if (user) {
      const otp = generateOtp();
      const otpHash = hashOtp(challengeId, otp);
      const expiresAt = otpExpiresAt();

      db.prepare(
        `INSERT INTO registration_otps (challenge_id, email, otp_hash, attempts, expires_at)
         VALUES (?, ?, ?, 0, ?)`,
      ).run(challengeId, email, otpHash, expiresAt);

      const { subject, htmlBody } = loginOtpEmail(otp);
      await getEmailProvider().send({ to: email, subject, htmlBody });
    }

    return ok({ challengeId });
  } catch (error: unknown) {
    return fail(error instanceof Error ? error.message : "发送验证码失败");
  }
}
