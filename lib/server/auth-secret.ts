const DEFAULT_AUTH_SECRET = "yanshu-dev-secret-change-me";

/** 解析签发会话令牌的密钥；未配置时使用前后端一致的固定回退密钥。 */
export function getAuthSecret(env: NodeJS.ProcessEnv = process.env): string {
  if (env.AUTH_SECRET) return env.AUTH_SECRET;
  if (env.NODE_ENV === "production") {
    throw new Error("生产环境必须配置 AUTH_SECRET");
  }
  console.warn(
    `[auth] 未配置 AUTH_SECRET，使用固定默认密钥；生产环境建议配置独立密钥。`,
  );
  return DEFAULT_AUTH_SECRET;
}
