"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/layout/logo";
import { toast } from "@/stores/toast";

/**
 * 找回密码页 `/reset-password` —— 独立整页(无侧边栏)
 * 演示环境暂不支持自助找回:给出诚实提示 + 操作反馈,不再是无响应的死表单。
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
  const [username, setUsername] = React.useState("");
  const [account, setAccount] = React.useState("");

  /** 演示环境:不假装发送验证码/重置,给出明确反馈 */
  const handleReset = () => {
    if (!username.trim() || !account.trim()) {
      toast.error("请先填写用户名和账号");
      return;
    }
    toast.info("演示环境暂不支持自助找回，请使用演示账号登录");
  };

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

        <div className="mt-5 flex items-start gap-2 rounded-xl bg-chip px-3 py-2.5 text-xs leading-relaxed text-muted">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-faint" />
          <span>
            当前为演示环境，暂不支持邮件/短信验证码。
            可使用演示账号 <span className="font-medium text-ink-2">hankairun / yanshu123</span> 登录体验完整功能。
          </span>
        </div>

        <div className="mt-4 flex flex-col gap-4">
          <Field
            label="用户名"
            placeholder="请输入用户名"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <Field
            label="账号"
            placeholder="请输入邮箱或手机号"
            value={account}
            onChange={(e) => setAccount(e.target.value)}
          />
          <Button className="mt-1 w-full" onClick={handleReset}>
            重置密码
          </Button>
        </div>

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
