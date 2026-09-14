/**
 * POST /api/auth/login/verify-otp
 * 验证登录邮箱验证码，通过后签发登录 token
 * Body: { email: string, challengeId: string, otp: string }
 */
import { NextRequest } from "next/server";
import { ensureSeed, fail, ok, parseBody } from "@/lib/server/utils";
import { allowRequest } from "@/lib/server/rate-limit";
import { getDB } from "@/lib/server/db";
import {
  hashOtp,
  normalizeEmail,
  otpMatches,
  OTP_MAX_ATTEMPTS,
} from "@/lib/server/email-otp";
import { loginWithEmail } from "@/lib/server/auth";

export const runtime = "nodejs";

interface OtpRow {
  email: string;
  otp_hash: string;
  scene: string;
  attempts: number;
  expires_at: string;
}

export async function POST(req: NextRequest) {
  ensureSeed();

  // 速率限制：每 IP 每 60 秒最多 5 次
  if (!allowRequest(req, "login-verify-otp", 5, 60_000)) {
    return fail("请求过于频繁，请稍后再试", 429, "RATE_LIMITED");
  }

  try {
    const body = await parseBody<{
      email: string;
      challengeId: string;
      otp: string;
    }>(req);

    const email = normalizeEmail(body.email || "");
    const challengeId = (body.challengeId || "").trim();
    const otp = (body.otp || "").trim();

    if (!email || !challengeId || !/^\d{6}$/.test(otp)) {
      return fail("参数不完整或验证码格式错误", 422, "INVALID_PARAMS");
    }

    const db = getDB();
    const result = db.transaction(() => {
      const row = db
        .prepare(
          "SELECT email, otp_hash, scene, attempts, expires_at FROM registration_otps WHERE challenge_id = ?",
        )
        .get(challengeId) as OtpRow | undefined;

      if (!row) return { status: "expired" as const };
      if (row.scene !== "login") return { status: "invalid" as const };
      if (new Date(row.expires_at).getTime() < Date.now()) {
        db.prepare("DELETE FROM registration_otps WHERE challenge_id = ?").run(challengeId);
        return { status: "expired" as const };
      }
      if (row.email !== email) return { status: "invalid" as const };
      if (row.attempts >= OTP_MAX_ATTEMPTS) {
        db.prepare("DELETE FROM registration_otps WHERE challenge_id = ?").run(challengeId);
        return { status: "too-many-attempts" as const };
      }

      const candidateHash = hashOtp(challengeId, otp);
      if (!otpMatches(candidateHash, row.otp_hash)) {
        db.prepare(
          "UPDATE registration_otps SET attempts = attempts + 1 WHERE challenge_id = ? AND attempts < ?",
        ).run(challengeId, OTP_MAX_ATTEMPTS);
        return { status: "invalid" as const };
      }

      const consumed = db
        .prepare("DELETE FROM registration_otps WHERE challenge_id = ?")
        .run(challengeId);
      if (consumed.changes !== 1) return { status: "expired" as const };

      const auth = loginWithEmail(email);
      if (!auth) return { status: "email-not-registered" as const };
      return { status: "ok" as const, auth };
    })();

    if (result.status === "expired") {
      return fail("验证码已失效，请重新获取", 400, "OTP_EXPIRED");
    }
    if (result.status === "too-many-attempts") {
      return fail("验证码尝试次数过多，请重新获取", 403, "TOO_MANY_ATTEMPTS");
    }
    if (result.status === "email-not-registered") {
      return fail("该邮箱未注册，请先注册", 404, "EMAIL_NOT_REGISTERED");
    }
    if (result.status !== "ok") {
      return fail("验证码错误，请检查后重试", 400, "INVALID_OTP");
    }

    // 会话 token 只通过 HttpOnly Cookie 下发，避免暴露给浏览器 JavaScript。
    const response = ok({ user: result.auth.user });
    response.cookies.set("yanshu_session", result.auth.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (error: unknown) {
    return fail(error instanceof Error ? error.message : "验证失败");
  }
}
