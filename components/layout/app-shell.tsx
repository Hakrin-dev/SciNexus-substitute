"use client";

import type { ReactNode } from "react";
import { Suspense } from "react";
import { AppSidebar } from "./app-sidebar";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { MockDataBadge } from "./mock-data-badge";
import { useSidebarStore } from "@/stores/sidebar";
import { cn } from "@/lib/utils";

/**
 * 应用外壳 —— 固定左侧栏 + 内容区
 * (论文阅读器等沉浸式页面不使用此布局)
 * 侧边栏折叠时内容区位置自适应左移,内部布局不变
 *
 * 为什么用两层 Suspense?
 * 1) <AppSidebar /> 内部用了 useSearchParams()(ScholarSubNav/PaperSubNav 写 URL 过滤),
 *    Next.js 对静态/预渲染(含 next build 阶段生成静态页面)要求「任何调用
 *    useSearchParams 的客户端组件」必须处于 Suspense 边界内,否则会抛:
 *      "useSearchParams() should be wrapped in a suspense boundary"
 * 2) 内容区的 children 也会包含若干直接调用 useSearchParams 的组件
 *    (LibraryTable/ScholarsBrowser/WorkbenchShell/NotesBoard 内可能间接依赖它),
 *    因此把 AppShell 顶层包两层 Suspense,**从根层面兜底**,避免每一个页面单独写
 *    `<Suspense><Xxx/></Suspense>`(过去就出现过 /knowledge/notes 漏写导致 CI
 *    Docker 构建 `next build --turbopack` 阶段 `Generating static pages` 直接退出
 *    `ELIFECYCLE 1`)。
 *
 * fallback={null} 符合官方推荐:SSR/静态构建阶段先渲染空壳,hydration 后再用
 * useSidebarStore 的真实 collapsed 状态 / URL searchParams 真实值替换。
 */
export function AppShell({ children }: { children: ReactNode }) {
  const collapsed = useSidebarStore((s) => s.collapsed);

  return (
    <div className="min-h-screen bg-background">
      <Suspense fallback={null}>
        <AppSidebar />
      </Suspense>
      <MockDataBadge />
      {/* 移动端顶栏 */}
      <header className="sticky top-0 z-20 flex h-14 items-center border-b border-line bg-card px-4 lg:hidden">
        <Logo />
        <ThemeToggle className="ml-auto" />
      </header>
      <main
        className={cn(
          "transition-[padding] duration-200",
          collapsed ? "lg:pl-16" : "lg:pl-60",
        )}
      >
        <Suspense fallback={null}>{children}</Suspense>
      </main>
    </div>
  );
}
