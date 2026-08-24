import type { ComponentType } from "react";
import { AppShell } from "@/components/layout/app-shell";

/** 工具库子页骨架:logo 徽标 + 标题 + 占位卡片(侧边栏副标题不显示 logo,仅在页面呈现) */
export function ToolPage({
  title,
  icon: Icon,
  placeholder,
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  placeholder: string;
}) {
  return (
    <AppShell>
      <div className="mx-auto max-w-[1180px] px-8 py-6">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft">
            <Icon className="size-5 text-primary" />
          </span>
          <h1 className="text-xl font-bold text-ink">{title}</h1>
        </div>
        <div className="mt-6 rounded-2xl bg-card p-8 text-sm text-muted shadow-card">
          {placeholder}
        </div>
      </div>
    </AppShell>
  );
}
