"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/layout/logo";

/**
 * 找回密码页 `/reset-password` —— 独立整页(无侧边栏),纯演示无真实逻辑
 * 从登录弹窗「忘记密码?」进入
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

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-card">
        <div className="flex flex-col items-center gap-2">
          <Logo compact />
          <h1 className="text-base font-semibold text-ink">找回密码</h1>
          <p className="text-xs text-muted">
            验证账号身份后即可重置密码
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-4">
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
          <Field label="新密码" type="password" placeholder="请输入新密码" />
          <Field
            label="请再次输入确认新密码"
            type="password"
            placeholder="请再次输入新密码"
          />
          <Button className="mt-1 w-full">重置密码</Button>
        </div>

        <div className="mt-4 flex justify-center">
          <Link
            href="/"
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
