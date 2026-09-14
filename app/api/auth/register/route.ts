/**
 * POST /api/auth/register
 * 用户注册（需先通过邮箱验证码验证，携带 registration_ticket Cookie）
 * Body: { username: string, password: string, displayName?: string }
 *
 * 邮箱从 ticket 中获取，确保注册邮箱与验证邮箱一致。
 */
import { NextRequest } from "next/server";
import { ensureSeed, fail, ok, parseBody } from "@/lib/server/utils";
import { register } from "@/lib/server/auth";
import { allowRequest } from "@/lib/server/rate-limit";
import { getDB } from "@/lib/server/db";
import { hashTicket, normalizeEmail } from "@/lib/server/email-otp";
import {
  validatePasswordPolicy,
  PASSWORD_POLICY_MESSAGE,
} from "@/lib/server/password-policy";
import { decodeCookieValue } from "@/lib/server/cookie";

export const runtime = "nodejs";

const REGISTRATION_TICKET_COOKIE = "registration_ticket";

/** 从 Cookie 中提取 ticket。 */
function extractTicket(req: NextRequest): string | null {
  const cookie = req.headers.get("cookie") || "";
  const encoded = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${REGISTRATION_TICKET_COOKIE}=`))
    ?.slice(REGISTRATION_TICKET_COOKIE.length + 1);
  if (!encoded) return null;
  return decodeCookieValue(encoded);
}

export async function POST(req: NextRequest) {
  ensureSeed();
  if (!allowRequest(req, "auth-register", 5, 60 * 60_000))
    return fail("注册次数过多，请稍后再试", 429, "RATE_LIMITED");

  try {
    // 校验 ticket
    const ticket = extractTicket(req);
    if (!ticket) {
      return fail("邮箱验证已失效，请重新验证", 403, "EMAIL_NOT_VERIFIED");
    }

    const db = getDB();
    const ticketHash = hashTicket(ticket);
    const ticketRow = db
      .prepare(
        "SELECT email, expires_at FROM registration_tickets WHERE ticket_hash = ?",
      )
      .get(ticketHash) as { email: string; expires_at: string } | undefined;

    if (!ticketRow) {
      return fail("邮箱验证已失效，请重新验证", 403, "EMAIL_NOT_VERIFIED");
    }
    if (new Date(ticketRow.expires_at).getTime() < Date.now()) {
      db.prepare("DELETE FROM registration_tickets WHERE ticket_hash = ?").run(ticketHash);
      return fail("邮箱验证已过期，请重新验证", 403, "EMAIL_NOT_VERIFIED");
    }

    const email = normalizeEmail(ticketRow.email);

    const body = await parseBody<{
      username: string;
      password: string;
      displayName?: string;
    }>(req);

    // 用户名校验
    const username = body.username?.trim();
    if (
      !username ||
      username.length < 2 ||
      username.length > 40 ||
      !/^[\p{L}\p{N}_.-]+$/u.test(username)
    ) {
      return fail(
        "用户名需为 2-40 个字符，仅可包含文字、数字、点、横线和下划线",
        422,
        "INVALID_USERNAME",
      );
    }

    // 密码策略校验
    const passwordPolicy = validatePasswordPolicy(body.password || "");
    if (!passwordPolicy.valid) {
      return fail(PASSWORD_POLICY_MESSAGE, 422, "PASSWORD_POLICY_VIOLATION");
    }

    const result = db.transaction(() => {
      // 重新读取 ticket，并与用户创建、ticket 消费放在同一事务中，防止并发重放。
      const currentTicket = db
        .prepare(
          "SELECT email, expires_at FROM registration_tickets WHERE ticket_hash = ?",
        )
        .get(ticketHash) as { email: string; expires_at: string } | undefined;
      if (!currentTicket) return { error: "邮箱验证已失效，请重新验证" };
      if (new Date(currentTicket.expires_at).getTime() < Date.now()) {
        db.prepare("DELETE FROM registration_tickets WHERE ticket_hash = ?").run(ticketHash);
        return { error: "邮箱验证已过期，请重新验证" };
      }

      const authResult = register({
        username,
        password: body.password,
        email,
        displayName: body.displayName?.trim() || username,
      });
      if ("error" in authResult) return authResult;

      const consumed = db
        .prepare("DELETE FROM registration_tickets WHERE ticket_hash = ?")
        .run(ticketHash);
      if (consumed.changes !== 1) {
        throw new Error("REGISTRATION_TICKET_CONSUME_FAILED");
      }
      return authResult;
    })();

    if ("error" in result) {
      return fail(result.error);
    }

    // 会话 token 只通过 HttpOnly Cookie 下发，避免暴露给浏览器 JavaScript。
    const response = ok({ user: result.user });
    response.cookies.set("yanshu_session", result.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });
    // 清除 ticket Cookie
    response.cookies.set(REGISTRATION_TICKET_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      String((error as { code?: unknown }).code).startsWith("SQLITE_CONSTRAINT")
    ) {
      return fail("用户名或邮箱已被注册", 409, "ACCOUNT_ALREADY_EXISTS");
    }
    return fail(error instanceof Error ? error.message : "注册失败");
  }
}
