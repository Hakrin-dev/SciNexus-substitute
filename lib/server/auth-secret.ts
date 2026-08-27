/** 解析签发会话令牌的密钥；生产环境不得使用公开开发回退。 */
export function getAuthSecret(env: NodeJS.ProcessEnv = process.env): string {
  if (env.AUTH_SECRET) return env.AUTH_SECRET;
  if (env.NODE_ENV === "production") {
    throw new Error("[auth] 生产环境必须配置 AUTH_SECRET。");
  }
  console.warn("[auth] 未配置 AUTH_SECRET，使用开发默认密钥；生产环境请务必通过环境变量配置。");
  return "yanshu-dev-secret-change-me";
}
