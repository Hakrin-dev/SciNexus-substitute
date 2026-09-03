/**
 * 密码哈希模块（独立、无依赖，供 utils 与 seed 共用，避免循环依赖）
 * 采用 PBKDF2 + 随机盐，存储格式为 `salt:hash`
 */
import { pbkdf2Sync, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const PBKDF2_ITERATIONS = 10_000;
const PBKDF2_KEYLEN = 32;
const PBKDF2_DIGEST = "sha256";
const SCRYPT_KEYLEN = 32;

export function hashPassword(pwd: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pwd, salt, SCRYPT_KEYLEN).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(pwd: string, stored: string): boolean {
  try {
    if (stored.startsWith("scrypt$")) {
      const [, salt, hash] = stored.split("$");
      if (!salt || !hash) return false;
      const expected = Buffer.from(hash, "hex");
      const computed = scryptSync(pwd, salt, expected.length);
      return expected.length === computed.length && timingSafeEqual(computed, expected);
    }
    // 兼容旧 PBKDF2 记录；成功登录后由 auth.ts 自动升级。
    const [salt, hash] = String(stored || "").split(":");
    if (!salt || !hash) return false;
    const expected = Buffer.from(hash, "hex");
    const computed = pbkdf2Sync(pwd, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST);
    return expected.length === computed.length && timingSafeEqual(computed, expected);
  } catch {
    return false;
  }
}

export function passwordHashNeedsUpgrade(stored: string): boolean {
  return !stored.startsWith("scrypt$");
}
