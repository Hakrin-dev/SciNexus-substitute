"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { Check, Circle, X } from "lucide-react";
import githubLogo from "@/brand/LOGO/Github.png";
import googleLogo from "@/brand/LOGO/Google.svg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/stores/auth";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  validatePasswordPolicy,
} from "@/lib/server/password-policy";
import { cn } from "@/lib/utils";
import { Turnstile, isTurnstileConfigured } from "@/components/auth/turnstile";

/**
 * 登录弹窗
 * - 账密登录：真实接口 /api/auth/login
 * - 免密登录：邮箱验证码登录（真实接口）
 * - 第三方登录：后端未支持，保留为演示入口(demoLogin)
 * - 注册：三段式（邮箱 → 验证码 → 凭证），走真实后端
 */

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
}

type RegisterStage = "email" | "verify-email" | "credentials";

function Field({
  label,
  ...props
}: React.ComponentProps<"input"> & { label: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-ink-2">{label}</span>
      <Input {...props} />
    </label>
  );
}

function ErrorText({ children }: { children?: string }) {
  if (!children) return null;
  return <p className="text-xs text-red-600 dark:text-red-400">{children}</p>;
}

function NoticeText({ children }: { children?: string }) {
  if (!children) return null;
  return <p className="text-xs leading-5 text-muted" role="status">{children}</p>;
}

/** 密码规则单项显示。 */
function PasswordRule({
  label,
  valid,
  started,
}: {
  label: string;
  valid: boolean;
  started: boolean;
}) {
  const state = !started ? "neutral" : valid ? "valid" : "invalid";
  return (
    <li
      className={cn(
        "flex items-center gap-2 text-xs transition-colors",
        state === "neutral" && "text-faint",
        state === "valid" && "text-emerald-600 dark:text-emerald-400",
        state === "invalid" && "text-red-600 dark:text-red-400",
      )}
    >
      {state === "neutral" ? (
        <Circle className="size-3.5 shrink-0" aria-hidden="true" />
      ) : (
        <span
          className="flex size-3.5 shrink-0 items-center justify-center rounded-full border border-current"
          aria-hidden="true"
        >
          {state === "valid" ? (
            <Check className="size-2.5" strokeWidth={2.5} />
          ) : (
            <X className="size-2.5" strokeWidth={2.5} />
          )}
        </span>
      )}
      <span>{label}</span>
    </li>
  );
}

/** 密码规则提示面板（聚焦密码框时显示）。 */
function PasswordRequirements({
  password,
  started,
}: {
  password: string;
  started: boolean;
}) {
  const result = validatePasswordPolicy(password);
  return (
    <div className="mt-2 w-full rounded-xl border border-line bg-card p-3">
      <p className="text-xs font-medium text-ink-2">密码需满足以下条件</p>
      <ul className="mt-2 flex flex-col gap-1.5">
        <PasswordRule
          label={`${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} 位`}
          valid={result.lengthValid}
          started={started}
        />
        <PasswordRule
          label="包含大写字母"
          valid={!result.missing.includes("uppercase")}
          started={started}
        />
        <PasswordRule
          label="包含小写字母"
          valid={!result.missing.includes("lowercase")}
          started={started}
        />
        <PasswordRule
          label="包含数字"
          valid={!result.missing.includes("digit")}
          started={started}
        />
      </ul>
    </div>
  );
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function LoginModal({ open, onClose }: LoginModalProps) {
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const sendRegisterOtp = useAuthStore((s) => s.sendRegisterOtp);
  const verifyRegisterOtp = useAuthStore((s) => s.verifyRegisterOtp);
  const sendLoginOtp = useAuthStore((s) => s.sendLoginOtp);
  const verifyLoginOtp = useAuthStore((s) => s.verifyLoginOtp);
  const demoLogin = useAuthStore((s) => s.demoLogin);
  const loading = useAuthStore((s) => s.loading);

  // 账密登录表单
  const [account, setAccount] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loginError, setLoginError] = React.useState<string>();

  // 免密登录（邮箱验证码）表单
  const [codeEmail, setCodeEmail] = React.useState("");
  const [codeOtp, setCodeOtp] = React.useState("");
  const [codeChallengeId, setCodeChallengeId] = React.useState("");
  const [codeSent, setCodeSent] = React.useState(false);
  const [codeCooldown, setCodeCooldown] = React.useState(0);
  const [codeCaptchaToken, setCodeCaptchaToken] = React.useState<string | undefined>();
  const [codeError, setCodeError] = React.useState<string>();
  const [codeNotice, setCodeNotice] = React.useState<string>();

  // 注册表单
  const [regStage, setRegStage] = React.useState<RegisterStage>("email");
  const [regEmail, setRegEmail] = React.useState("");
  const [regChallengeId, setRegChallengeId] = React.useState("");
  const [regCode, setRegCode] = React.useState("");
  const [regCodeCooldown, setRegCodeCooldown] = React.useState(0);
  const [regCaptchaToken, setRegCaptchaToken] = React.useState<string | undefined>();
  const [regEmailError, setRegEmailError] = React.useState<string>();
  const [regEmailNotice, setRegEmailNotice] = React.useState<string>();
  const [regCodeError, setRegCodeError] = React.useState<string>();
  const [regCodeNotice, setRegCodeNotice] = React.useState<string>();

  const [regName, setRegName] = React.useState("");
  const [regPassword, setRegPassword] = React.useState("");
  const [regPasswordConfirm, setRegPasswordConfirm] = React.useState("");
  const [regPasswordFocused, setRegPasswordFocused] = React.useState(false);
  const [regPasswordTouched, setRegPasswordTouched] = React.useState(false);
  const [regPasswordStarted, setRegPasswordStarted] = React.useState(false);
  const [regError, setRegError] = React.useState<string>();

  const regPasswordValidation = validatePasswordPolicy(regPassword);
  const showRegPasswordResult = regPasswordTouched && !regPasswordFocused;

  // 验证码冷却倒计时（注册 + 登录共用逻辑，分别计时）
  React.useEffect(() => {
    if (regCodeCooldown <= 0 && codeCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setRegCodeCooldown((v) => Math.max(0, v - 1));
      setCodeCooldown((v) => Math.max(0, v - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [regCodeCooldown, codeCooldown]);

  // ESC 关闭
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  /** 重置注册表单 */
  const resetRegister = React.useCallback(() => {
    setRegStage("email");
    setRegEmail("");
    setRegChallengeId("");
    setRegCode("");
    setRegCodeCooldown(0);
    setRegCaptchaToken(undefined);
    setRegEmailError(undefined);
    setRegEmailNotice(undefined);
    setRegCodeError(undefined);
    setRegCodeNotice(undefined);
    setRegName("");
    setRegPassword("");
    setRegPasswordConfirm("");
    setRegPasswordFocused(false);
    setRegPasswordTouched(false);
    setRegPasswordStarted(false);
    setRegError(undefined);
  }, []);

  /** 重置免密登录表单 */
  const resetCodeLogin = React.useCallback(() => {
    setCodeEmail("");
    setCodeOtp("");
    setCodeChallengeId("");
    setCodeSent(false);
    setCodeCooldown(0);
    setCodeCaptchaToken(undefined);
    setCodeError(undefined);
    setCodeNotice(undefined);
  }, []);

  /** 账密登录 */
  const handleLogin = async () => {
    setLoginError(undefined);
    if (!account.trim() || !password) {
      setLoginError("请输入账号和密码");
      return;
    }
    const result = await login(account.trim(), password);
    if (result.ok) {
      onClose();
    } else {
      setLoginError(result.error);
    }
  };

  /** 免密登录：发送验证码 */
  const handleSendLoginOtp = async () => {
    setCodeError(undefined);
    setCodeNotice(undefined);
    const email = normalizeEmail(codeEmail);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setCodeError("请输入有效的邮箱地址");
      return;
    }
    if (isTurnstileConfigured() && !codeCaptchaToken) {
      setCodeError("请先完成人机验证");
      return;
    }
    const result = await sendLoginOtp(email, codeCaptchaToken);
    if (result.ok) {
      setCodeChallengeId(result.challengeId || "");
      setCodeSent(true);
      setCodeCooldown(60);
      setCodeNotice("验证码已发送，请查收邮件");
    } else {
      setCodeError(result.error || "发送验证码失败");
    }
  };

  /** 免密登录：重新发送验证码 */
  const handleResendLoginOtp = async () => {
    if (codeCooldown > 0) return;
    setCodeError(undefined);
    setCodeNotice(undefined);
    const result = await sendLoginOtp(normalizeEmail(codeEmail), codeCaptchaToken);
    if (result.ok) {
      setCodeCooldown(60);
      setCodeNotice("验证码已重新发送，请查收邮件");
    } else {
      setCodeError(result.error || "发送验证码失败");
    }
  };

  /** 免密登录：验证并登录 */
  const handleVerifyLoginOtp = async () => {
    setCodeError(undefined);
    setCodeNotice(undefined);
    const otp = codeOtp.trim();
    if (!/^\d{6}$/.test(otp)) {
      setCodeError("请输入 6 位数字验证码");
      return;
    }
    if (!codeChallengeId) {
      // 如果没有 challengeId，说明之前 send-otp 返回的是 success 但没有 challengeId（防枚举）
      // 此时后端可能没有生成 challenge，但 verify 会失败。给出提示。
      setCodeError("请先获取验证码");
      return;
    }
    const result = await verifyLoginOtp({
      email: normalizeEmail(codeEmail),
      challengeId: codeChallengeId,
      otp,
    });
    if (result.ok) {
      onClose();
    } else {
      setCodeError(result.error);
    }
  };

  /** 发送注册验证码 */
  const handleSendOtp = async () => {
    setRegEmailError(undefined);
    setRegEmailNotice(undefined);
    const email = normalizeEmail(regEmail);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setRegEmailError("请输入有效的邮箱地址");
      return;
    }
    if (isTurnstileConfigured() && !regCaptchaToken) {
      setRegEmailError("请先完成人机验证");
      return;
    }
    const result = await sendRegisterOtp(email, regCaptchaToken);
    if (result.ok && result.challengeId) {
      setRegChallengeId(result.challengeId);
      setRegCode("");
      setRegCodeCooldown(60);
      setRegStage("verify-email");
      setRegCodeNotice("验证码已发送，请查收邮件");
    } else {
      setRegEmailError(result.error || "发送验证码失败");
    }
  };

  /** 重新发送注册验证码 */
  const handleResendOtp = async () => {
    if (regCodeCooldown > 0) return;
    setRegCodeError(undefined);
    setRegCodeNotice(undefined);
    const result = await sendRegisterOtp(normalizeEmail(regEmail), regCaptchaToken);
    if (result.ok && result.challengeId) {
      setRegChallengeId(result.challengeId);
      setRegCode("");
      setRegCodeCooldown(60);
      setRegCodeNotice("验证码已重新发送，请查收邮件");
    } else {
      setRegCodeError(result.error || "发送验证码失败");
    }
  };

  /** 验证注册验证码 */
  const handleVerifyOtp = async () => {
    setRegCodeError(undefined);
    setRegCodeNotice(undefined);
    const otp = regCode.trim();
    if (!/^\d{6}$/.test(otp)) {
      setRegCodeError("请输入 6 位数字验证码");
      return;
    }
    if (!regChallengeId) {
      setRegCodeError("验证码已失效，请重新获取");
      return;
    }
    const result = await verifyRegisterOtp({
      email: normalizeEmail(regEmail),
      challengeId: regChallengeId,
      otp,
    });
    if (result.ok) {
      setRegStage("credentials");
      setRegCodeNotice(undefined);
    } else {
      setRegCodeError(result.error || "验证失败");
    }
  };

  /** 更换邮箱 */
  const handleChangeEmail = () => {
    setRegStage("email");
    setRegChallengeId("");
    setRegCode("");
    setRegCodeError(undefined);
    setRegCodeNotice(undefined);
    setRegCodeCooldown(0);
  };

  /** 完成注册 */
  const handleRegister = async () => {
    setRegError(undefined);
    setRegPasswordTouched(true);
    const name = regName.trim();
    if (name.length < 2) {
      setRegError("用户名至少 2 个字符");
      return;
    }
    if (!regPasswordValidation.valid) {
      setRegError(
        `密码需为 ${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} 位，且至少包含大写字母、小写字母和数字`,
      );
      return;
    }
    if (regPassword !== regPasswordConfirm) {
      setRegError("两次输入的密码不一致");
      return;
    }
    const result = await register({
      username: name,
      password: regPassword,
      email: normalizeEmail(regEmail),
      displayName: name,
    });
    if (result.ok) {
      onClose();
    } else {
      setRegError(result.error);
    }
  };

  /** 第三方登录（演示） */
  const handleDemo = async () => {
    setLoginError(undefined);
    const ok = await demoLogin();
    if (ok) onClose();
    else setLoginError("演示登录失败，请确认后端服务已启动");
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="登录"
        className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">登录研枢</h2>
          <button
            type="button"
            aria-label="关闭"
            className="rounded-md p-1 text-faint hover:bg-chip hover:text-ink"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>

        <Tabs defaultValue="password" className="mt-4">
          <TabsList className="w-full justify-start border-b border-line">
            <TabsTrigger value="password">账密登录</TabsTrigger>
            <TabsTrigger value="code" onClick={resetCodeLogin}>免密登录</TabsTrigger>
            <TabsTrigger value="register" onClick={resetRegister}>注册</TabsTrigger>
          </TabsList>

          {/* 账密登录 */}
          <TabsContent value="password" className="mt-5 flex flex-col gap-4">
            <Field
              label="账号/用户名"
              placeholder="请输入账号或用户名"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              autoComplete="username"
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
            <Field
              label="密码"
              type="password"
              placeholder="请输入密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
            <ErrorText>{loginError}</ErrorText>
            <div className="-mt-1.5 flex justify-end">
              <Link
                href="/reset-password"
                onClick={onClose}
                className="text-[13px] font-medium text-primary hover:underline"
              >
                忘记密码?
              </Link>
            </div>
            <Button className="w-full" onClick={handleLogin} disabled={loading}>
              {loading ? "登录中…" : "登录"}
            </Button>
          </TabsContent>

          {/* 免密登录（邮箱验证码） */}
          <TabsContent value="code" className="mt-5 flex flex-col gap-4">
            <Field
              label="邮箱"
              type="email"
              placeholder="请输入注册邮箱"
              value={codeEmail}
              onChange={(e) => {
                setCodeEmail(e.target.value);
                setCodeSent(false);
                setCodeChallengeId("");
              }}
              autoComplete="email"
              disabled={codeSent}
            />
            {isTurnstileConfigured() && !codeSent && (
              <Turnstile
                onVerify={(token) => setCodeCaptchaToken(token)}
                onError={() => setCodeCaptchaToken(undefined)}
              />
            )}
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-ink-2">验证码</span>
              <div className="flex gap-2">
                <Input
                  placeholder="请输入 6 位验证码"
                  className="flex-1"
                  inputMode="numeric"
                  maxLength={6}
                  value={codeOtp}
                  onChange={(e) => setCodeOtp(e.target.value.replace(/\D/g, ""))}
                  autoComplete="one-time-code"
                  onKeyDown={(e) => e.key === "Enter" && handleVerifyLoginOtp()}
                  disabled={!codeSent}
                />
                <Button
                  variant="outline"
                  type="button"
                  className="shrink-0"
                  disabled={codeCooldown > 0 || loading}
                  onClick={codeSent ? handleResendLoginOtp : handleSendLoginOtp}
                >
                  {codeCooldown > 0 ? `${codeCooldown}s` : codeSent ? "重新发送" : "获取验证码"}
                </Button>
              </div>
            </div>
            <ErrorText>{codeError}</ErrorText>
            <NoticeText>{codeNotice}</NoticeText>
            <Button className="w-full" onClick={handleVerifyLoginOtp} disabled={loading || !codeSent}>
              {loading ? "登录中…" : "登录"}
            </Button>

            {/* 分割线 + 第三方关联登录 */}
            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-line" />
              <span className="text-xs text-faint">其他登录方式</span>
              <span className="h-px flex-1 bg-line" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                type="button"
                onClick={handleDemo}
                className="w-full"
              >
                <Image
                  src={githubLogo}
                  alt="GitHub"
                  width={16}
                  height={16}
                  className="size-4 rounded-full"
                />
                GitHub 登录
              </Button>
              <Button
                variant="outline"
                type="button"
                onClick={handleDemo}
                className="w-full"
              >
                <Image
                  src={googleLogo}
                  alt="Google"
                  width={16}
                  height={16}
                  className="size-4"
                />
                Google 登录
              </Button>
            </div>
          </TabsContent>

          {/* 注册（三段式） */}
          <TabsContent value="register" className="mt-5 flex flex-col gap-4">
            {regStage === "email" && (
              <>
                <p className="text-[13px] leading-5 text-muted">
                  先验证邮箱，再设置用户名和密码
                </p>
                <Field
                  label="邮箱"
                  type="email"
                  placeholder="请输入邮箱"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  autoComplete="email"
                  onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
                />
                {isTurnstileConfigured() && (
                  <Turnstile
                    onVerify={(token) => setRegCaptchaToken(token)}
                    onError={() => setRegCaptchaToken(undefined)}
                  />
                )}
                <ErrorText>{regEmailError}</ErrorText>
                <NoticeText>{regEmailNotice}</NoticeText>
                <Button className="w-full" onClick={handleSendOtp} disabled={loading}>
                  获取验证码
                </Button>
              </>
            )}

            {regStage === "verify-email" && (
              <>
                <Field label="邮箱" type="email" value={regEmail} readOnly className="bg-panel text-muted" />
                <div className="-mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleChangeEmail}
                    className="text-[13px] font-medium text-primary hover:underline"
                  >
                    更换邮箱
                  </button>
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-medium text-ink-2">验证码</span>
                  <div className="flex gap-2">
                    <Input
                      placeholder="请输入 6 位验证码"
                      className="flex-1"
                      inputMode="numeric"
                      maxLength={6}
                      value={regCode}
                      onChange={(e) => setRegCode(e.target.value.replace(/\D/g, ""))}
                      autoComplete="one-time-code"
                      onKeyDown={(e) => e.key === "Enter" && handleVerifyOtp()}
                    />
                    <Button
                      variant="outline"
                      type="button"
                      className="shrink-0"
                      disabled={regCodeCooldown > 0 || loading}
                      onClick={handleResendOtp}
                    >
                      {regCodeCooldown > 0 ? `${regCodeCooldown}s` : "重新发送"}
                    </Button>
                  </div>
                </div>
                <ErrorText>{regCodeError}</ErrorText>
                <NoticeText>{regCodeNotice}</NoticeText>
                <Button className="w-full" onClick={handleVerifyOtp} disabled={loading}>
                  验证邮箱
                </Button>
              </>
            )}

            {regStage === "credentials" && (
              <>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-medium text-ink-2">邮箱</span>
                  <div className="relative">
                    <Input
                      type="email"
                      value={regEmail}
                      readOnly
                      className="bg-panel pr-16 text-muted"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      已验证
                    </span>
                  </div>
                </label>
                <Field
                  label="用户名"
                  placeholder="请输入用户名(2-40 个字符)"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  autoComplete="username"
                />
                <div className="relative">
                  <Field
                    label="密码"
                    type="password"
                    placeholder="请输入密码"
                    value={regPassword}
                    onChange={(e) => {
                      setRegPassword(e.target.value);
                      setRegPasswordTouched(true);
                      setRegPasswordStarted(true);
                    }}
                    onFocus={() => setRegPasswordFocused(true)}
                    onBlur={() => {
                      setRegPasswordFocused(false);
                      setRegPasswordTouched(true);
                    }}
                    autoComplete="new-password"
                  />
                  {regPasswordFocused && (
                    <PasswordRequirements
                      password={regPassword}
                      started={regPasswordStarted}
                    />
                  )}
                  {showRegPasswordResult && (
                    <p
                      className={cn(
                        "mt-1.5 text-xs",
                        regPasswordValidation.valid
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400",
                      )}
                    >
                      {regPasswordValidation.valid ? "密码符合要求" : "密码尚未满足全部要求"}
                    </p>
                  )}
                </div>
                <Field
                  label="确认密码"
                  type="password"
                  placeholder="请再次输入密码"
                  value={regPasswordConfirm}
                  onChange={(e) => setRegPasswordConfirm(e.target.value)}
                  autoComplete="new-password"
                  onKeyDown={(e) => e.key === "Enter" && handleRegister()}
                />
                <ErrorText>{regError}</ErrorText>
                <Button className="w-full" onClick={handleRegister} disabled={loading}>
                  {loading ? "注册中…" : "完成注册"}
                </Button>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
