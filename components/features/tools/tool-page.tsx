import type { ComponentType, ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";

/** 工具库子页骨架:logo 徽标 + 标题 + 内容区(children 优先,缺省为占位卡) */
export function ToolPage({
  title,
  subtitle,
  icon: Icon,
  placeholder,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: ComponentType<{ className?: string }>;
  placeholder: string;
  children?: ReactNode;
}) {
  return (
    <AppShell>
      <div className="mx-auto max-w-[1180px] px-8 py-6">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft">
            <Icon className="size-5 text-primary" />
          </span>
          <div>
            <h1 className="text-xl font-bold text-ink">{title}</h1>
            {subtitle && <p className="mt-0.5 text-xs text-faint">{subtitle}</p>}
          </div>
        </div>
        {children ? (
          <div className="mt-6">{children}</div>
        ) : (
          <div className="mt-6 rounded-2xl bg-card p-8 text-sm text-muted shadow-card">
            {placeholder}
          </div>
        )}
      </div>
    </AppShell>
  );
}
