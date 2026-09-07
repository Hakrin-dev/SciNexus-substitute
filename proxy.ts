import { NextRequest, NextResponse } from "next/server";

/** Cookie 会话的同源写保护。非浏览器客户端没有 Origin 时仍可使用 API。 */
export function proxy(req: NextRequest) {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.headers.get("origin");
    const forwardedHost = req.headers.get("x-forwarded-host") || req.headers.get("host");
    const forwardedProto = req.headers.get("x-forwarded-proto") || req.nextUrl.protocol.replace(":", "");
    const allowedOrigins = new Set([req.nextUrl.origin, forwardedHost ? `${forwardedProto}://${forwardedHost}` : ""]);
    // 本地开发允许 localhost 与 127.0.0.1 在相同端口互换；生产环境仍严格匹配代理后的公网 Origin。
    if (process.env.NODE_ENV !== "production" && forwardedHost) {
      const port = forwardedHost.includes(":") ? `:${forwardedHost.split(":").pop()}` : "";
      allowedOrigins.add(`http://localhost${port}`);
      allowedOrigins.add(`http://127.0.0.1${port}`);
    }
    if (origin && !allowedOrigins.has(origin)) {
      return NextResponse.json({ success: false, error: "跨站请求已拒绝", code: "CSRF_REJECTED" }, { status: 403 });
    }
  }
  return NextResponse.next();
}

export const config = { matcher: "/api/:path*" };
