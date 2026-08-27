import type { ComponentType, ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";

/** 知识库子页骨架:logo 徽标 + 标题(+ 可选标题后控件) + 内容区 */
export function KnowledgePage({
  title,
  subtitle,
  icon: Icon,
  headerRight,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: ComponentType<{ className?: string }>;
  /** 标题后的控件(如记忆总开关) */
  headerRight?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <AppShell>
      <div className="mx-auto max-w-[1180px] space-y-5 px-8 py-6">
        <div className="flex items-end justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft">
              <Icon className="size-5 text-primary" />
            </span>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-ink">{title}</h1>
                {headerRight}
              </div>
              {subtitle && <p className="mt-0.5 text-xs text-faint">{subtitle}</p>}
            </div>
          </div>
        </div>
        {children}
      </div>
    </AppShell>
  );
}
