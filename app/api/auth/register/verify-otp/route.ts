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
    const row = db
      .prepare(
        "SELECT email, otp_hash, attempts, expires_at FROM registration_otps WHERE challenge_id = ?",
      )
      .get(challengeId) as OtpRow | undefined;

    if (!row) {
      return fail("验证码已失效，请重新获取", 400, "OTP_EXPIRED");
    }

    // 过期检查
    if (new Date(row.expires_at).getTime() < Date.now()) {
      db.prepare("DELETE FROM registration_otps WHERE challenge_id = ?").run(challengeId);
      return fail("验证码已过期，请重新获取", 400, "OTP_EXPIRED");
    }

    // 邮箱匹配检查
    if (row.email !== email) {
      return fail("验证码错误，请检查后重试", 400, "INVALID_OTP");
    }

    // 尝试次数限制
    if (row.attempts >= OTP_MAX_ATTEMPTS) {
      db.prepare("DELETE FROM registration_otps WHERE challenge_id = ?").run(challengeId);
      return fail("验证码尝试次数过多，请重新获取", 403, "TOO_MANY_ATTEMPTS");
    }

    // 验证 OTP
    const candidateHash = hashOtp(challengeId, otp);
    if (!otpMatches(candidateHash, row.otp_hash)) {
      // 验证失败：递增尝试次数
      db.prepare(
        "UPDATE registration_otps SET attempts = attempts + 1 WHERE challenge_id = ?",
      ).run(challengeId);
      return fail("验证码错误，请检查后重试", 400, "INVALID_OTP");
    }

    // 验证通过：删除 challenge 记录，签发 ticket
    db.prepare("DELETE FROM registration_otps WHERE challenge_id = ?").run(challengeId);

    // 再次确认邮箱未被注册（防止验证期间被注册）
    const existing = db
      .prepare("SELECT COUNT(*) as n FROM users WHERE email = ?")
      .get(email) as { n: number };
    if (existing.n > 0) {
      return fail("该邮箱已注册，请直接登录", 409, "EMAIL_ALREADY_REGISTERED");
    }

    const ticket = generateTicket();
    const ticketHash = hashTicket(ticket);
    const expiresAt = ticketExpiresAt();

    db.prepare(
      `INSERT INTO registration_tickets (ticket_hash, email, expires_at)
       VALUES (?, ?, ?)`,
    ).run(ticketHash, email, expiresAt);

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
