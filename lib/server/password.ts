/**
 * 密码哈希模块（独立、无依赖，供 utils 与 seed 共用，避免循环依赖）
 * 采用 PBKDF2 + 随机盐，存储格式为 `pbkdf2_sha256$iterations$salt$hash`。
 * 验证器兼容旧的 `salt:hash`（10,000 次）并允许登录时平滑升级。
 */
import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";

const PBKDF2_ITERATIONS = 210_000;
const PBKDF2_KEYLEN = 32;
const PBKDF2_DIGEST = "sha256";

export function hashPassword(pwd: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(pwd, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST).toString("hex");
  return `pbkdf2_sha256$${PBKDF2_ITERATIONS}$${salt}$${hash}`;
}

export function verifyPassword(pwd: string, stored: string): boolean {
  const value = String(stored || "");
  const modern = value.split("$");
  const [salt, hash, iterations] = modern.length === 4
    ? [modern[2], modern[3], Number(modern[1])]
    : [...value.split(":"), 10_000] as [string, string, number];
  if (!salt || !hash) return false;
  if (!Number.isSafeInteger(iterations) || iterations < 10_000 || iterations > 1_000_000) return false;
  const expected = Buffer.from(hash, "hex");
  const computed = pbkdf2Sync(pwd, salt, iterations, PBKDF2_KEYLEN, PBKDF2_DIGEST);
  return expected.length === computed.length && timingSafeEqual(computed, expected);
}

export function passwordHashNeedsUpgrade(stored: string): boolean {
  const parts = String(stored || "").split("$");
  return parts.length !== 4 || parts[0] !== "pbkdf2_sha256" || Number(parts[1]) < PBKDF2_ITERATIONS;
}
