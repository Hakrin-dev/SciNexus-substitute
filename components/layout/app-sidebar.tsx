"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass,
  History,
  Layers,
  Library,
  MessageSquare,
  MoreHorizontal,
  Search,
  Send,
  Sparkles,
  User,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SITE } from "@/lib/constants";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";

interface NavItem {
  href: string;
  label: string;
  icon: typeof Compass;
  badge?: string;
  disabled?: boolean;
  /** 前缀匹配(用于详情页保持高亮) */
  matchPrefix?: string;
}

const RESEARCH_NAV: NavItem[] = [
  { href: "/", label: "发现", icon: Compass, badge: "新" },
  { href: "/submit", label: "投稿", icon: Send },
  { href: "/knowledge", label: "知识库", icon: Library },
  { href: "/agents", label: "AI 助手", icon: Sparkles },
  { href: "/projects", label: "科研项目", icon: Layers, disabled: true },
];

const EXPLORE_NAV: NavItem[] = [
  { href: "/scholars", label: "研究构想", icon: Users, matchPrefix: "/scholars" },
  { href: "/qa", label: "问答", icon: MessageSquare, disabled: true },
  { href: "/history", label: "搜索历史", icon: History, disabled: true },
];

function NavLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const active = item.matchPrefix
    ? pathname.startsWith(item.matchPrefix)
    : pathname === item.href;
  const Icon = item.icon;

  const inner = (
    <>
      <Icon className="size-[18px]" strokeWidth={1.8} />
      <span className="flex-1 text-[15px] font-medium">{item.label}</span>
      {item.badge && (
        <span className="rounded-full bg-brand-gold px-1.5 py-0.5 text-[10px] font-semibold leading-none text-ink">
          {item.badge}
        </span>
      )}
    </>
  );

  if (item.disabled) {
    return (
      <span
        title="即将上线"
        className="flex h-10 cursor-not-allowed items-center gap-3 rounded-xl px-3 text-muted/50"
      >
        {inner}
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-10 items-center gap-3 rounded-xl px-3 transition-colors",
        active
          ? "bg-primary text-white shadow-sm"
          : "text-ink-2 hover:bg-card",
      )}
    >
      {inner}
    </Link>
  );
}

/** 全局侧边栏 —— 对应 SVG 原型 240px 左侧栏(背景 #EEF1F8) */
export function AppSidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-sidebar px-4 py-5 lg:flex">
      <div className="flex items-center justify-between gap-2">
        <Logo />
        <ThemeToggle />
      </div>

      {/* 全局搜索入口 */}
      <button
        type="button"
        className="mt-5 flex h-10 w-full items-center gap-2.5 rounded-xl border border-line bg-card px-3 text-sm text-faint transition-colors hover:border-primary/40"
      >
        <Search className="size-4" />
        <span className="flex-1 text-left">搜索论文 · 提问 AI</span>
        <kbd className="rounded border border-line px-1.5 py-0.5 text-[10px] text-faint">
          ⌘K
        </kbd>
      </button>

      <nav className="mt-4 flex flex-1 flex-col gap-0.5 overflow-y-auto">
        <p className="px-3 pb-1.5 pt-2 text-[11px] font-medium tracking-wide text-faint">
          研究
        </p>
        {RESEARCH_NAV.map((item) => (
          <NavLink key={item.label} item={item} />
        ))}
        <p className="px-3 pb-1.5 pt-4 text-[11px] font-medium tracking-wide text-faint">
          探索
        </p>
        {EXPLORE_NAV.map((item) => (
          <NavLink key={item.label} item={item} />
        ))}
      </nav>

      {/* 用户卡片 */}
      <div className="mt-4 flex items-center gap-2.5 rounded-xl bg-card p-2.5 shadow-card">
        <span className="flex size-9 items-center justify-center rounded-full bg-primary-soft">
          <User className="size-4.5 text-primary" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="truncate text-[13px] font-semibold text-ink">
            {SITE.user.name}
          </span>
          <span className="truncate text-[11px] text-muted">
            {SITE.user.title}
          </span>
        </span>
        <button
          type="button"
          aria-label="更多"
          className="rounded-md p-1 text-faint hover:bg-chip"
        >
          <MoreHorizontal className="size-4" />
        </button>
      </div>
    </aside>
  );
}
