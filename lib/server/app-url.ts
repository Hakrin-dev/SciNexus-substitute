/** 获取用于邮件链接的可信应用地址。 */
export function getPublicAppUrl(): string {
  const raw = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "").trim();
  if (!raw) {
    if (process.env.NODE_ENV === "production") throw new Error("APP_URL_NOT_CONFIGURED");
    return "http://localhost:3000";
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("APP_URL_INVALID");
  }

  if (url.username || url.password || url.search || url.hash) {
    throw new Error("APP_URL_INVALID");
  }
  if (
    process.env.NODE_ENV === "production" &&
    (url.protocol !== "https:" || ["localhost", "127.0.0.1", "::1"].includes(url.hostname))
  ) {
    throw new Error("APP_URL_INSECURE");
  }
  return url.origin;
}
