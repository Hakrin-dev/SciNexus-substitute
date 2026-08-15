"use client";

import * as React from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/stores/auth";

/**
 * 登录弹窗(纯演示,不做真实登录/注册逻辑)
 * 三个 Tab:账密登录 / 验证码登录 / 注册
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

export function LoginModal({ open, onClose }: LoginModalProps) {
  const login = useAuthStore((s) => s.login);
  /** 演示:点击登录即视为登录成功 */
  const handleLogin = () => {
    login();
    onClose();
  };

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

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
            <TabsTrigger value="code">验证码登录</TabsTrigger>
            <TabsTrigger value="register">注册</TabsTrigger>
          </TabsList>

          <TabsContent value="password" className="mt-5 flex flex-col gap-4">
            <Field label="账号/用户名" placeholder="请输入账号或用户名" />
            <Field label="密码" type="password" placeholder="请输入密码" />
            <div className="-mt-1.5 flex justify-end">
              <Link
                href="/reset-password"
                onClick={onClose}
                className="text-[13px] font-medium text-primary hover:underline"
              >
                忘记密码?
              </Link>
            </div>
            <Button className="w-full" onClick={handleLogin}>
              登录
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
            <Button className="mt-1 w-full" onClick={handleLogin}>
              登录
            </Button>
          </TabsContent>

          <TabsContent value="register" className="mt-5 flex flex-col gap-4">
            <Field label="用户名" placeholder="请输入用户名" />
            <Field label="账号" placeholder="请输入邮箱或手机号" />
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-ink-2">验证码</span>
              <div className="flex gap-2">
                <Input placeholder="请输入验证码" className="flex-1" />
                <Button variant="outline" type="button" className="shrink-0">
                  获取验证码
                </Button>
              </div>
            </div>
            <Button className="mt-1 w-full" onClick={onClose}>
              注册
            </Button>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
