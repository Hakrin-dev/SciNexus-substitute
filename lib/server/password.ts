/**
 * 密码哈希模块（独立、无依赖，供 utils 与 seed 共用，避免循环依赖）
 * 采用 PBKDF2 + 随机盐，存储格式为 `salt:hash`
 */
import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";

const PBKDF2_ITERATIONS = 10_000;
const PBKDF2_KEYLEN = 32;
const PBKDF2_DIGEST = "sha256";

export function hashPassword(pwd: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(pwd, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(pwd: string, stored: string): boolean {
  const [salt, hash] = String(stored || "").split(":");
  if (!salt || !hash) return false;
  const computed = pbkdf2Sync(pwd, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST);
  const computedHex = computed.toString("hex");
  // hash 与 computedHex 等长，可安全比较
  return timingSafeEqual(Buffer.from(computedHex, "hex"), Buffer.from(hash, "hex"));
}
