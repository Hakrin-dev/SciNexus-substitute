/**
 * 密码策略模块（借鉴深知 lib/auth/policies/password.ts）
 *
 * 仅对「新注册」和「密码重置/修改」生效；
 * 现有用户（含 demo 账号 yanshu123）登录不受影响，不强制重置。
 */

export type PasswordCompositionRule = "uppercase" | "lowercase" | "digit";

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 64;

export interface PasswordCompositionResult {
  valid: boolean;
  missing: PasswordCompositionRule[];
}

export interface PasswordPolicyResult extends PasswordCompositionResult {
  lengthValid: boolean;
}

/** 密码组合规则校验：大写、小写、数字。 */
export function validatePasswordComposition(
  password: string,
): PasswordCompositionResult {
  const missing: PasswordCompositionRule[] = [];

  if (!/[A-Z]/.test(password)) missing.push("uppercase");
  if (!/[a-z]/.test(password)) missing.push("lowercase");
  if (!/[0-9]/.test(password)) missing.push("digit");

  return {
    valid: missing.length === 0,
    missing,
  };
}

/** 完整密码策略：长度 + 组合。 */
export function validatePasswordPolicy(password: string): PasswordPolicyResult {
  const composition = validatePasswordComposition(password);
  const lengthValid =
    password.length >= PASSWORD_MIN_LENGTH &&
    password.length <= PASSWORD_MAX_LENGTH;

  return {
    ...composition,
    lengthValid,
    valid: lengthValid && composition.valid,
  };
}

/** 用户可读的策略说明，用于注册/重置页提示与后端错误消息。 */
export const PASSWORD_POLICY_MESSAGE =
  `密码需为 ${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} 位，且至少包含大写字母、小写字母和数字`;
