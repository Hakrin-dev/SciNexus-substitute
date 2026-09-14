import Dm20151123, * as $Dm20151123 from "@alicloud/dm20151123";

/**
 * 邮件 Provider 抽象
 *
 * 支持阿里云 DirectMail（与深知一致）；
 * 未配置时降级为「控制台打印验证码」，便于本地开发调试。
 */

export interface SendEmailParams {
  to: string;
  subject: string;
  htmlBody: string;
}

export interface EmailProvider {
  send(params: SendEmailParams): Promise<void>;
}

const EMAIL_PROVIDER_NOT_CONFIGURED_CODE = "EMAIL_PROVIDER_NOT_CONFIGURED";

/** 读取可选环境变量。 */
function optionalEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}

function parseBooleanEnv(name: string): boolean {
  const value = optionalEnv(name);
  if (value === undefined) return false;
  return value === "1" || value.toLowerCase() === "true";
}

interface AlibabaDirectMailConfig {
  accessKeyId: string;
  accessKeySecret: string;
  regionId: string;
  endpoint: string;
  from: string;
  fromAlias?: string;
}

function getAlibabaDirectMailConfig(): AlibabaDirectMailConfig | undefined {
  if (optionalEnv("EMAIL_PROVIDER") !== "aliyun-directmail") return undefined;

  const accessKeyId = optionalEnv("ALIBABA_CLOUD_ACCESS_KEY_ID");
  const accessKeySecret = optionalEnv("ALIBABA_CLOUD_ACCESS_KEY_SECRET");
  const regionId = optionalEnv("ALIYUN_DIRECTMAIL_REGION_ID");
  const endpoint = optionalEnv("ALIYUN_DIRECTMAIL_ENDPOINT");
  const from = optionalEnv("AUTH_EMAIL_FROM");

  if (!accessKeyId || !accessKeySecret || !regionId || !endpoint || !from) {
    return undefined;
  }

  const fromAlias = optionalEnv("AUTH_EMAIL_FROM_ALIAS");
  return { accessKeyId, accessKeySecret, regionId, endpoint, from, ...(fromAlias ? { fromAlias } : {}) };
}

/** 控制台降级 Provider：开发环境未配置邮件服务时使用。 */
class ConsoleEmailProvider implements EmailProvider {
  async send({ to, subject, htmlBody }: SendEmailParams): Promise<void> {
    // 提取所有链接 URL（便于开发调试，如密码重置链接）
    const urls = Array.from(htmlBody.matchAll(/href="([^"]+)"/g), (m) => m[1]);
    // 从 HTML 中提取纯文本（简单去标签），便于控制台查看验证码
    const text = htmlBody
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    console.log(
      `[email:console] To=${to} | Subject=${subject}\n${text}${
        urls.length ? `\n链接: ${urls.join("\n      ")}` : ""
      }`,
    );
  }
}

/** 阿里云 DirectMail Provider。 */
class AlibabaDirectMailProvider implements EmailProvider {
  constructor(private readonly config: AlibabaDirectMailConfig) {}

  async send({ to, subject, htmlBody }: SendEmailParams): Promise<void> {
    const { accessKeyId, accessKeySecret, endpoint, from, fromAlias } = this.config;
    const client = new Dm20151123({
      accessKeyId,
      accessKeySecret,
      endpoint,
    } as ConstructorParameters<typeof Dm20151123>[0]);

    const request = new $Dm20151123.SingleSendMailRequest({
      AccountName: from,
      AddressType: 1,
      ReplyToAddress: false,
      ToAddress: to,
      Subject: subject,
      HtmlBody: htmlBody,
      ...(fromAlias ? { FromAlias: fromAlias } : {}),
    });

    try {
      await client.singleSendMail(request);
    } catch {
      // SDK 的错误对象可能包含请求参数或服务端响应，不能直接返回给客户端。
      throw new Error("EMAIL_SEND_FAILED");
    }
  }
}

let cachedProvider: EmailProvider | null = null;

/**
 * 获取邮件 Provider 实例（单例）。
 * 配置完整时返回阿里云 DirectMail；否则返回控制台降级 Provider。
 */
export function getEmailProvider(): EmailProvider {
  if (cachedProvider) return cachedProvider;

  const dmConfig = getAlibabaDirectMailConfig();
  cachedProvider = dmConfig
    ? new AlibabaDirectMailProvider(dmConfig)
    : new ConsoleEmailProvider();
  return cachedProvider;
}

/** 邮件服务是否已真正配置（非控制台降级）。 */
export function isEmailDeliveryConfigured(): boolean {
  return getAlibabaDirectMailConfig() !== undefined;
}

export { EMAIL_PROVIDER_NOT_CONFIGURED_CODE };

/** 生产环境是否强制启用邮件服务（默认 false，允许开发降级）。 */
export function isEmailRequired(): boolean {
  return parseBooleanEnv("EMAIL_REQUIRED");
}

/**
 * 生产环境始终要求真实邮件投递；开发环境可通过 EMAIL_REQUIRED=true
 * 提前模拟生产行为。该策略不能被生产环境的 .env.example 默认值关闭。
 */
export function isEmailDeliveryRequired(): boolean {
  return process.env.NODE_ENV === "production" || isEmailRequired();
}

/** 将 Provider 的内部异常转换为稳定的公开错误，避免泄露 SDK 响应正文。 */
export function emailProviderFailure(error: unknown): {
  message: string;
  status: number;
  code: string;
} | null {
  if (
    error instanceof Error &&
    (error.message === EMAIL_PROVIDER_NOT_CONFIGURED_CODE ||
      error.message === "EMAIL_SEND_FAILED")
  ) {
    return {
      message:
        error.message === EMAIL_PROVIDER_NOT_CONFIGURED_CODE
          ? "邮件服务尚未配置，暂时无法发送邮件"
          : "邮件服务暂时不可用，请稍后重试",
      status: 503,
      code:
        error.message === EMAIL_PROVIDER_NOT_CONFIGURED_CODE
          ? EMAIL_PROVIDER_NOT_CONFIGURED_CODE
          : "EMAIL_SEND_FAILED",
    };
  }
  return null;
}
