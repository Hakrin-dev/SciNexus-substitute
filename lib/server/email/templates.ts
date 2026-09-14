/**
 * 邮件模板
 */

const BRAND = "研枢 SciNexus";

/** 注册邮箱验证码邮件 HTML。 */
export function registrationOtpEmail(otp: string): { subject: string; htmlBody: string } {
  const subject = `【${BRAND}】注册验证码`;
  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1f2937;">
      <h2 style="margin: 0 0 16px; font-size: 20px;">${BRAND} 注册验证码</h2>
      <p style="margin: 0 0 12px; line-height: 1.6;">您好，</p>
      <p style="margin: 0 0 12px; line-height: 1.6;">您正在注册 ${BRAND} 账号，本次验证码为：</p>
      <div style="margin: 16px 0; padding: 16px; background: #f5f3ff; border-radius: 8px; text-align: center;">
        <span style="font-size: 28px; font-weight: 700; letter-spacing: 8px; color: #5046e5;">${otp}</span>
      </div>
      <p style="margin: 0 0 8px; line-height: 1.6; color: #6b7280; font-size: 14px;">
        验证码 5 分钟内有效，请勿泄露给他人。
      </p>
      <p style="margin: 0; line-height: 1.6; color: #9ca3af; font-size: 12px;">
        如非本人操作，请忽略此邮件。
      </p>
    </div>
  `;
  return { subject, htmlBody };
}

/** 登录邮箱验证码邮件 HTML。 */
export function loginOtpEmail(otp: string): { subject: string; htmlBody: string } {
  const subject = `【${BRAND}】登录验证码`;
  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1f2937;">
      <h2 style="margin: 0 0 16px; font-size: 20px;">${BRAND} 登录验证码</h2>
      <p style="margin: 0 0 12px; line-height: 1.6;">您好，</p>
      <p style="margin: 0 0 12px; line-height: 1.6;">您正在登录 ${BRAND}，本次验证码为：</p>
      <div style="margin: 16px 0; padding: 16px; background: #f5f3ff; border-radius: 8px; text-align: center;">
        <span style="font-size: 28px; font-weight: 700; letter-spacing: 8px; color: #5046e5;">${otp}</span>
      </div>
      <p style="margin: 0 0 8px; line-height: 1.6; color: #6b7280; font-size: 14px;">
        验证码 5 分钟内有效，请勿泄露给他人。
      </p>
      <p style="margin: 0; line-height: 1.6; color: #9ca3af; font-size: 12px;">
        如非本人操作，请忽略此邮件。
      </p>
    </div>
  `;
  return { subject, htmlBody };
}

/** 密码重置邮件 HTML（含重置链接）。 */
export function passwordResetEmail(resetUrl: string | URL): { subject: string; htmlBody: string } {
  const subject = `【${BRAND}】重置密码`;
  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1f2937;">
      <h2 style="margin: 0 0 16px; font-size: 20px;">重置 ${BRAND} 密码</h2>
      <p style="margin: 0 0 12px; line-height: 1.6;">您好，</p>
      <p style="margin: 0 0 12px; line-height: 1.6;">您申请了重置密码，请点击下方链接完成重置：</p>
      <div style="margin: 16px 0;">
        <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background: #5046e5; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">
          重置密码
        </a>
      </div>
      <p style="margin: 0 0 8px; line-height: 1.6; color: #6b7280; font-size: 14px;">
        链接 30 分钟内有效，请勿泄露给他人。
      </p>
      <p style="margin: 0; line-height: 1.6; color: #9ca3af; font-size: 12px;">
        如非本人操作，请忽略此邮件。
      </p>
    </div>
  `;
  return { subject, htmlBody };
}
