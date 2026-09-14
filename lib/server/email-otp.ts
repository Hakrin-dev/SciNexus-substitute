/**
 * 邮箱验证码（OTP）工具
 *
 * 借鉴深知 registration-email-verification 插件的 challenge 机制：
 * - 发送时生成 challengeId，OTP 仅存 HMAC 哈希（不存明文）
 * - 验证时用 constant-time 比较，防止时序攻击
 * - 尝试次数限制 + 过期时间
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getAuthSecret } from "./auth-secret";

export const OTP_LENGTH = 6;
export const OTP_EXPIRES_IN_SECONDS = 5 * 60; // 5 分钟
export const OTP_MAX_ATTEMPTS = 3;

/** 生成 6 位数字验证码。 */
export function generateOtp(): string {
  // 用随机字节生成，避免 Math.random 的可预测性
  const buf = randomBytes(4);
  const num = buf.readUInt32BE(0) % 1_000_000;
  return num.toString().padStart(OTP_LENGTH, "0");
}

/** 生成 challengeId（32 位十六进制随机串）。 */
export function generateChallengeId(): string {
  return randomBytes(16).toString("hex");
}

/** 生成注册 ticket（48 位十六进制随机串）。 */
export function generateTicket(): string {
  return randomBytes(24).toString("hex");
}

/** 对 OTP 进行 HMAC-SHA256 签名存储。 */
export function hashOtp(challengeId: string, otp: string): string {
  return createHmac("sha256", getAuthSecret())
    .update(`${challengeId}:${otp}`)
    .digest("hex");
}

/** 对 ticket 进行 HMAC-SHA256 签名存储（ticket 本身不存明文）。 */
export function hashTicket(ticket: string): string {
  return createHmac("sha256", getAuthSecret()).update(ticket).digest("hex");
}

/** 常数时间比较 OTP 哈希。 */
export function otpMatches(candidateHash: string, storedHash: string): boolean {
  const a = Buffer.from(candidateHash, "hex");
  const b = Buffer.from(storedHash, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** 计算过期时间戳（ISO 字符串，便于 SQLite 存储与比较）。 */
export function otpExpiresAt(): string {
  return new Date(Date.now() + OTP_EXPIRES_IN_SECONDS * 1000).toISOString();
}

/** ticket 过期时间（10 分钟，足够完成注册表单填写）。 */
export const TICKET_EXPIRES_IN_SECONDS = 10 * 60;

export function ticketExpiresAt(): string {
  return new Date(Date.now() + TICKET_EXPIRES_IN_SECONDS * 1000).toISOString();
}

/** 密码重置 token 过期时间（30 分钟）。 */
export const PASSWORD_RESET_EXPIRES_IN_SECONDS = 30 * 60;

export function passwordResetExpiresAt(): string {
  return new Date(Date.now() + PASSWORD_RESET_EXPIRES_IN_SECONDS * 1000).toISOString();
}

/** 邮箱归一化：去空白 + 转小写。 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
