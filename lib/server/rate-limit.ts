import { createHash } from "node:crypto";
import { getDB } from "./db";

export function clientAddress(req: Request): string {
  return (req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || "unknown").trim();
}

export function allowRequest(req: Request, bucket: string, limit: number, windowMs: number): boolean {
  return allowRateLimitKey(`${bucket}:${clientAddress(req)}`, limit, windowMs);
}

/**
 * 按业务身份限流。调用方必须先做规范化（例如邮箱转小写），避免同一
 * 账号通过大小写或空白绕过失败计数。
 */
export function allowRateLimitKey(identity: string, limit: number, windowMs: number): boolean {
  const key = createHash("sha256").update(identity).digest("hex");
  const now = Date.now();
  const db = getDB();
  return db.transaction(() => {
    const row = db.prepare("SELECT count,window_started_at FROM rate_limits WHERE key=?").get(key) as { count: number; window_started_at: number } | undefined;
    if (!row || now - row.window_started_at >= windowMs) {
      db.prepare("INSERT INTO rate_limits (key,count,window_started_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=1,window_started_at=excluded.window_started_at").run(key, now);
      return true;
    }
    if (row.count >= limit) return false;
    db.prepare("UPDATE rate_limits SET count=count+1 WHERE key=?").run(key);
    return true;
  })();
}

/** 清除一个业务限流键，例如登录成功后清除账号失败计数。 */
export function clearRateLimitKey(identity: string): void {
  const key = createHash("sha256").update(identity).digest("hex");
  getDB().prepare("DELETE FROM rate_limits WHERE key=?").run(key);
}
