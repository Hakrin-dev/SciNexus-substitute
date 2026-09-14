/**
 * POST /api/auth/register/send-otp
 * 发送注册邮箱验证码
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
import {
  getEmailProvider,
  emailProviderFailure,
  isEmailDeliveryConfigured,
  isEmailDeliveryRequired,
} from "@/lib/server/email/provider";
import { registrationOtpEmail } from "@/lib/server/email/templates";
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
  if (!allowRequest(req, "register-send-otp", 3, 60_000)) {
    return fail("请求过于频繁，请稍后再试", 429, "RATE_LIMITED");
  }

  try {
    // Turnstile 人机验证（已启用时生效，未启用时放行）
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

    // 检查邮箱是否已注册
    const db = getDB();
    const existing = db
      .prepare("SELECT COUNT(*) as n FROM users WHERE email = ?")
      .get(email) as { n: number };
    if (existing.n > 0) {
      return fail("该邮箱已注册，请直接登录", 409, "EMAIL_ALREADY_REGISTERED");
    }

    // 邮件服务未配置时直接报错（开发环境会降级为控制台输出，但生产需明确提示）
    if (!isEmailDeliveryConfigured() && isEmailDeliveryRequired()) {
      return fail(
        "邮件服务尚未配置，暂时无法发送验证码",
        503,
        EMAIL_PROVIDER_NOT_CONFIGURED_CODE,
      );
    }

    const challengeId = generateChallengeId();
    const otp = generateOtp();
    const otpHash = hashOtp(challengeId, otp);
    const expiresAt = otpExpiresAt();

    db.prepare(
      `INSERT INTO registration_otps (challenge_id, email, otp_hash, scene, attempts, expires_at)
       VALUES (?, ?, ?, 'registration', 0, ?)`,
    ).run(challengeId, email, otpHash, expiresAt);

    // 发送邮件（开发环境未配置时会打印到控制台）
    const { subject, htmlBody } = registrationOtpEmail(otp);
    try {
      await getEmailProvider().send({ to: email, subject, htmlBody });
    } catch (error) {
      // 邮件未发出时不能留下可被后续请求继续尝试的 challenge。
      db.prepare("DELETE FROM registration_otps WHERE challenge_id = ?").run(challengeId);
      throw error;
    }

    return ok({ challengeId });
  } catch (error: unknown) {
    const failure = emailProviderFailure(error);
    if (failure) return fail(failure.message, failure.status, failure.code);
    return fail("发送验证码失败");
  }
}
