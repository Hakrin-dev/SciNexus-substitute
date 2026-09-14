"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/layout/logo";
import client from "@/lib/api/client";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  validatePasswordPolicy,
} from "@/lib/server/password-policy";
import { Turnstile, isTurnstileConfigured } from "@/components/auth/turnstile";

/**
 * 找回密码页 `/reset-password` —— 独立整页(无侧边栏)
 * - 无 token 参数：输入邮箱申请重置链接
 * - 有 token 参数：设置新密码
 */

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

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [email, setEmail] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [captchaToken, setCaptchaToken] = React.useState<string | undefined>();

  const isResetMode = Boolean(token);

  /** 申请重置密码：发送邮件 */
  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("请输入有效的邮箱地址");
      return;
    }
    if (isTurnstileConfigured() && !captchaToken) {
      setError("请先完成人机验证");
      return;
    }
    setSubmitting(true);
    try {
      const resp = await client.auth.requestPasswordReset(normalizedEmail, captchaToken);
      if (resp.success) {
        setNotice("如果该邮箱已注册，我们会发送重置邮件。");
      } else {
        setError(resp.error || "发送失败，请稍后重试");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "发送失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  /** 重置密码 */
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (!token) {
      setError("重置链接无效，请重新申请");
      return;
    }
    if (!validatePasswordPolicy(newPassword).valid) {
      setError(
        `密码需为 ${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} 位，且至少包含大写字母、小写字母和数字`,
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }

    setSubmitting(true);
    try {
      const resp = await client.auth.resetPassword({ token, newPassword, confirmPassword });
      if (resp.success) {
        setNewPassword("");
        setConfirmPassword("");
        setNotice("密码已重置，请使用新密码登录。");
      } else {
        setError(resp.error || "重置失败，请重新申请重置链接");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "重置失败，请重新申请重置链接");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-card">
        <div className="flex flex-col items-center gap-2">
          <Logo compact />
          <h1 className="text-base font-semibold text-ink">
            {isResetMode ? "重置密码" : "找回密码"}
          </h1>
          <p className="text-xs text-muted">
            {isResetMode ? "设置一个新的登录密码" : "输入邮箱后，我们会发送密码重置链接"}
          </p>
        </div>

        {isResetMode ? (
          <form className="mt-6 flex flex-col gap-4" onSubmit={handleResetPassword}>
            <Field
              label="新密码"
              type="password"
              placeholder="请输入新密码"
              autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH}
              maxLength={PASSWORD_MAX_LENGTH}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <p className="-mt-2 text-xs text-muted">
              {`密码需为 ${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} 位，且至少包含大写字母、小写字母和数字`}
            </p>
            <Field
              label="确认新密码"
              type="password"
              placeholder="请再次输入新密码"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            {error && <p className="text-xs text-red-600 dark:text-red-400" role="alert">{error}</p>}
            {notice && <p className="text-xs text-muted" role="status">{notice}</p>}
            <Button type="submit" className="mt-1 w-full" disabled={submitting}>
              {submitting ? "重置中..." : "重置密码"}
            </Button>
          </form>
        ) : (
          <form className="mt-6 flex flex-col gap-4" onSubmit={handleRequestReset}>
            <Field
              label="邮箱"
              type="email"
              placeholder="请输入注册邮箱"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {isTurnstileConfigured() && (
              <Turnstile
                onVerify={(t) => setCaptchaToken(t)}
                onError={() => setCaptchaToken(undefined)}
              />
            )}
            {error && <p className="text-xs text-red-600 dark:text-red-400" role="alert">{error}</p>}
            {notice && <p className="text-xs text-muted" role="status">{notice}</p>}
            <Button type="submit" className="mt-1 w-full" disabled={submitting}>
              {submitting ? "发送中..." : "发送重置邮件"}
            </Button>
          </form>
        )}

        <div className="mt-4 flex justify-center">
          <Link
            href="/?login=1"
            className="flex items-center gap-1 text-[13px] text-muted transition-colors hover:text-primary"
          >
            <ArrowLeft className="size-3.5" />
            返回登录
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen" aria-hidden="true" />}>
      <ResetPasswordContent />
    </React.Suspense>
  );
}
