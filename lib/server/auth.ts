/**
 * 简单会话认证模块（基于 HMAC 签名的 token，演示用）
 * 生产环境建议使用 NextAuth/Auth.js
 *
 * token 含版本号：登出时递增用户 token_version，使旧 token 立即失效。
 */
import { createHmac } from "node:crypto";
import { getDB } from "./db";
import { getAuthSecret } from "./auth-secret";
import { hashPassword, verifyPassword, genId } from "./utils";

export interface User {
  id: string;
  username: string;
  email: string | null;
  display_name: string | null;
  avatar_color: string;
}

export interface AuthResult {
  token: string;
  user: User;
}

// token 有效期 7 天
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function sign(userId: string, version: number, expireTs: number): string {
  const payload = `${userId}:${version}:${expireTs}`;
  const sig = createHmac("sha256", getAuthSecret()).update(payload).digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

function verify(token: string): { userId: string; version: number } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const [userId, versionStr, expireTsStr, sig] = decoded.split(":");
    const version = parseInt(versionStr, 10);
    const expireTs = parseInt(expireTsStr, 10);
    if (!userId || isNaN(version) || !expireTs || Date.now() > expireTs) return null;
    const expectedSig = createHmac("sha256", getAuthSecret())
      .update(`${userId}:${version}:${expireTs}`)
      .digest("hex");
    if (sig !== expectedSig) return null;
    return { userId, version };
  } catch {
    return null;
  }
}

/** 从 Authorization header 中提取 token */
export function extractToken(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (!auth) return null;
  const parts = auth.split(" ");
  if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
    return parts[1];
  }
  return parts[0] || null;
}

function toUser(row: any): User {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    display_name: row.display_name,
    avatar_color: row.avatar_color,
  };
}

/** 获取当前用户（无 token 或 token 无效返回 null） */
export function getCurrentUser(req: Request): User | null {
  const token = extractToken(req);
  if (!token) return null;
  const payload = verify(token);
  if (!payload) return null;
  const db = getDB();
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(payload.userId) as any;
  if (!row) return null;
  // token 版本校验：登出后 version 递增，旧 token 失效
  if ((row.token_version || 0) !== payload.version) return null;
  return toUser(row);
}

/**
 * 强制鉴权：返回当前用户，未登录返回 null。
 * 调用方据此返回 401，杜绝越权访问私人数据。
 */
export function requireAuth(req: Request): User | null {
  return getCurrentUser(req);
}

/** 登出：使该用户所有已签发 token 失效 */
export function revokeAllTokens(userId: string): void {
  getDB()
    .prepare("UPDATE users SET token_version = token_version + 1 WHERE id = ?")
    .run(userId);
}

/** 登录 */
export function login(username: string, password: string): AuthResult | null {
  const db = getDB();
  const row = db
    .prepare("SELECT * FROM users WHERE username = ? OR email = ?")
    .get(username, username) as any;
  if (!row) return null;
  if (!verifyPassword(password, row.password_hash)) return null;
  const version = row.token_version || 0;
  const expire = Date.now() + TOKEN_TTL_MS;
  const token = sign(row.id, version, expire);
  return { token, user: toUser(row) };
}

/** 注册 */
export function register(params: {
  username: string;
  password: string;
  email?: string;
  displayName?: string;
}): AuthResult | { error: string } {
  const db = getDB();
  // 检查用户名重复
  const exists = db
    .prepare("SELECT COUNT(*) as n FROM users WHERE username = ?")
    .get(params.username) as any;
  if (exists.n > 0) {
    return { error: "用户名已存在" };
  }
  if (params.email) {
    const emailExists = db
      .prepare("SELECT COUNT(*) as n FROM users WHERE email = ?")
      .get(params.email) as any;
    if (emailExists.n > 0) {
      return { error: "邮箱已被注册" };
    }
  }
  const userId = genId("u_");
  const avatarColors = ["#5046E5", "#10B981", "#F59E0B", "#EC4899", "#8B5CF6", "#06B6D4"];
  const color = avatarColors[Math.floor(Math.random() * avatarColors.length)];
  db.prepare(
    `INSERT INTO users (id, username, email, password_hash, display_name, avatar_color)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    userId,
    params.username,
    params.email || null,
    hashPassword(params.password),
    params.displayName || params.username,
    color
  );
  const expire = Date.now() + TOKEN_TTL_MS;
  const token = sign(userId, 0, expire);
  return {
    token,
    user: {
      id: userId,
      username: params.username,
      email: params.email || null,
      display_name: params.displayName || params.username,
      avatar_color: color,
    },
  };
}
