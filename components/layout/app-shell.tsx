import type { ReactNode } from "react";
import { AppSidebar } from "./app-sidebar";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";

/**
 * 应用外壳 —— 固定左侧栏 + 内容区
 * (论文阅读器等沉浸式页面不使用此布局)
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      {/* 移动端顶栏 */}
      <header className="sticky top-0 z-20 flex h-14 items-center border-b border-line bg-card px-4 lg:hidden">
        <Logo />
        <ThemeToggle className="ml-auto" />
      </header>
      <main className="lg:pl-60">{children}</main>
    </div>
  );
}
