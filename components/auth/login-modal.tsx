"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { X } from "lucide-react";
import githubLogo from "@/brand/LOGO/Github.png";
import googleLogo from "@/brand/LOGO/Google.svg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/stores/auth";

/**
 * 登录弹窗
 * 账密登录 / 注册走真实后端(/api/auth/*);免密登录与第三方登录后端未支持,
 * 保留为演示入口(demoLogin)。
 */

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
}

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

export function LoginModal({ open, onClose }: LoginModalProps) {
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const demoLogin = useAuthStore((s) => s.demoLogin);
  const loading = useAuthStore((s) => s.loading);

  const [account, setAccount] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loginError, setLoginError] = React.useState<string>();

  const [regName, setRegName] = React.useState("");
  const [regEmail, setRegEmail] = React.useState("");
  const [regPassword, setRegPassword] = React.useState("");
  const [regError, setRegError] = React.useState<string>();

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  /** 账密登录:真实接口 */
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

  /** 注册:真实接口 */
  const handleRegister = async () => {
    setRegError(undefined);
    if (regName.trim().length < 2) {
      setRegError("用户名至少 2 个字符");
      return;
    }
    if (regPassword.length < 6) {
      setRegError("密码至少 6 位");
      return;
    }
    const result = await register({
      username: regName.trim(),
      password: regPassword,
      email: regEmail.trim() || undefined,
      displayName: regName.trim(),
    });
    if (result.ok) {
      onClose();
    } else {
      setRegError(result.error);
    }
  };

  /** 免密/第三方登录:后端未支持,演示态直接进入 */
  const handleDemo = () => {
    demoLogin();
    onClose();
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
            <TabsTrigger value="code">免密登录</TabsTrigger>
            <TabsTrigger value="register">注册</TabsTrigger>
          </TabsList>

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

          <TabsContent value="code" className="mt-5 flex flex-col gap-4">
            <Field label="邮箱/手机号" placeholder="请输入邮箱或手机号" />
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-ink-2">验证码</span>
              <div className="flex gap-2">
                <Input placeholder="请输入验证码" className="flex-1" />
                <Button variant="outline" type="button" className="shrink-0">
                  获取验证码
                </Button>
              </div>
            </div>
            <Button className="mt-1 w-full" onClick={handleDemo} disabled={loading}>
              登录(演示)
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

          <TabsContent value="register" className="mt-5 flex flex-col gap-4">
            <Field
              label="用户名"
              placeholder="请输入用户名(至少 2 个字符)"
              value={regName}
              onChange={(e) => setRegName(e.target.value)}
            />
            <Field
              label="邮箱(可选)"
              placeholder="请输入邮箱"
              type="email"
              value={regEmail}
              onChange={(e) => setRegEmail(e.target.value)}
            />
            <Field
              label="密码"
              type="password"
              placeholder="请输入密码(至少 6 位)"
              value={regPassword}
              onChange={(e) => setRegPassword(e.target.value)}
              autoComplete="new-password"
              onKeyDown={(e) => e.key === "Enter" && handleRegister()}
            />
            <ErrorText>{regError}</ErrorText>
            <Button className="w-full" onClick={handleRegister} disabled={loading}>
              注册并登录
            </Button>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
