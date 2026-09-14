/**
 * POST /api/auth/register/verify-otp
 * 验证注册邮箱验证码，通过后签发一次性 ticket（HttpOnly Cookie）
 * Body: { email: string, challengeId: string, otp: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { ensureSeed, fail, parseBody } from "@/lib/server/utils";
import { allowRequest } from "@/lib/server/rate-limit";
import { getDB } from "@/lib/server/db";
import {
  generateTicket,
  hashOtp,
  hashTicket,
  normalizeEmail,
  otpMatches,
  OTP_MAX_ATTEMPTS,
  ticketExpiresAt,
} from "@/lib/server/email-otp";

export const runtime = "nodejs";

const REGISTRATION_TICKET_COOKIE = "registration_ticket";

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
  if (!allowRequest(req, "register-verify-otp", 5, 60_000)) {
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
    const ticket = generateTicket();
    const ticketHash = hashTicket(ticket);
    const expiresAt = ticketExpiresAt();
    const result = db.transaction(() => {
      const row = db
        .prepare(
          "SELECT email, otp_hash, scene, attempts, expires_at FROM registration_otps WHERE challenge_id = ?",
        )
        .get(challengeId) as OtpRow | undefined;

      if (!row) return { status: "expired" as const };
      if (row.scene !== "registration") return { status: "invalid" as const };

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

      // challenge 消费、邮箱重查和 ticket 写入必须在同一事务中完成，防止并发重放。
      const consumed = db
        .prepare("DELETE FROM registration_otps WHERE challenge_id = ?")
        .run(challengeId);
      if (consumed.changes !== 1) return { status: "expired" as const };

      const existing = db
        .prepare("SELECT COUNT(*) as n FROM users WHERE email = ?")
        .get(email) as { n: number };
      if (existing.n > 0) return { status: "already-registered" as const };

      db.prepare(
        `INSERT INTO registration_tickets (ticket_hash, email, expires_at)
         VALUES (?, ?, ?)`,
      ).run(ticketHash, email, expiresAt);
      return { status: "verified" as const };
    })();

    if (result.status === "expired") {
      return fail("验证码已失效，请重新获取", 400, "OTP_EXPIRED");
    }
    if (result.status === "too-many-attempts") {
      return fail("验证码尝试次数过多，请重新获取", 403, "TOO_MANY_ATTEMPTS");
    }
    if (result.status === "already-registered") {
      return fail("该邮箱已注册，请直接登录", 409, "EMAIL_ALREADY_REGISTERED");
    }
    if (result.status !== "verified") {
      return fail("验证码错误，请检查后重试", 400, "INVALID_OTP");
    }

    // 签发 HttpOnly Cookie（ticket 明文仅通过 Cookie 传递，不存 DB）
    const response = NextResponse.json({ data: { success: true }, success: true });
    response.cookies.set(REGISTRATION_TICKET_COOKIE, ticket, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 10 * 60, // 10 分钟
    });

    return response;
  } catch (error: unknown) {
    return fail(error instanceof Error ? error.message : "验证失败");
  }
}
