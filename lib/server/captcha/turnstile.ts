/**
 * Cloudflare Turnstile 人机验证模块
 *
 * 未配置时自动跳过（不影响流程），配置后对 send-otp 等敏感接口生效。
 */
import { NextRequest } from "next/server";

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

interface TurnstileConfig {
  secretKey: string;
  enabled: boolean;
}

let cachedConfig: TurnstileConfig | null = null;

function getTurnstileConfig(): TurnstileConfig {
  if (cachedConfig) return cachedConfig;

  const secretKey = process.env.TURNSTILE_SECRET_KEY?.trim();
  const enabledRaw = process.env.TURNSTILE_ENABLED?.trim().toLowerCase();
  // 显式设置 TURNSTILE_ENABLED=false 时禁用；否则只要配置了 secretKey 即启用
  const enabled = enabledRaw !== "false" && Boolean(secretKey);

  cachedConfig = { secretKey: secretKey || "", enabled };
  return cachedConfig;
}

/** Turnstile 是否已启用。 */
export function isTurnstileEnabled(): boolean {
  return getTurnstileConfig().enabled;
}

interface SiteverifyResponse {
  success: boolean;
  "error-codes"?: string[];
}

/**
 * 验证 Turnstile token。
 * 未启用时直接返回 true（放行）。
 */
export async function verifyTurnstileToken(
  token: string | undefined,
  remoteIP?: string,
): Promise<boolean> {
  const config = getTurnstileConfig();
  if (!config.enabled) return true;

  if (!token) return false;

  const body = new URLSearchParams({
    secret: config.secretKey,
    response: token,
  });
  if (remoteIP) body.append("remoteip", remoteIP);

  try {
    const resp = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const data = (await resp.json()) as SiteverifyResponse;
    return Boolean(data.success);
  } catch {
    // 网络异常时拒绝（fail-closed），避免绕过
    return false;
  }
}

/** 从请求中提取 Turnstile token（请求头 x-captcha-response）。 */
export function extractTurnstileToken(req: NextRequest): string | undefined {
  return req.headers.get("x-captcha-response") || undefined;
}

/** 获取客户端 IP。 */
export function getClientIP(req: NextRequest): string | undefined {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") || undefined;
}
