"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronDown,
  Compass,
  History,
  Layers,
  Library,
  MessageSquare,
  MoreHorizontal,
  Search,
  Send,
  Settings,
  Sparkles,
  User,
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
];

/** 「投稿」的子栏目:会议即原投稿页面,点击投稿默认打开 */
const SUBMIT_SUB_NAV = [
  { href: "/submit", label: "会议" },
  { href: "/submit/journals", label: "期刊" },
];

/** 「知识库」的子栏目:论文库即原知识库页面,点击知识库默认打开 */
const KNOWLEDGE_SUB_NAV = [
  { href: "/knowledge", label: "论文库" },
  { href: "/knowledge/patents", label: "专利库" },
  { href: "/knowledge/funding", label: "项目基金库" },
  { href: "/knowledge/scholars", label: "学者关系" },
  { href: "/knowledge/institutions", label: "研究机构" },
];

/** 「AI 助手」的子栏目;AI 助手本身有独立对话页(/agents),不与子栏目共享 */
const AGENT_SUB_NAV = [
  { href: "/agents/deep-research", label: "Deep Research" },
  { href: "/agents/auto-research", label: "Auto Research" },
];

const RESEARCH_NAV_AFTER: NavItem[] = [
  { href: "/projects", label: "科研项目", icon: Layers, disabled: true },
];

const HISTORY_NAV: NavItem[] = [
  { href: "/history", label: "搜索", icon: History, disabled: true },
  { href: "/qa", label: "研究", icon: MessageSquare, disabled: true },
  { href: "/deliveries", label: "投递", icon: Send, disabled: true },
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

/** 可展开导航项 —— 点击主体展开子栏目并进入默认页,右侧箭头只收起/展开 */
function ExpandableNav({
  href,
  label,
  icon: Icon,
  subNav,
}: {
  href: string;
  label: string;
  icon: typeof Compass;
  subNav: { href: string; label: string }[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const routeActive = pathname.startsWith(href);
  const [open, setOpen] = useState(routeActive);

  return (
    <div>
      <div
        className={cn(
          "flex h-10 items-center rounded-xl transition-colors",
          routeActive
            ? "bg-primary text-white shadow-sm"
            : "text-ink-2 hover:bg-card",
        )}
      >
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            router.push(href);
          }}
          className="flex h-full min-w-0 flex-1 items-center gap-3 pl-3 text-left"
        >
          <Icon className="size-[18px]" strokeWidth={1.8} />
          <span className="flex-1 text-[15px] font-medium">{label}</span>
        </button>
        <button
          type="button"
          aria-label={open ? `收起${label}子栏目` : `展开${label}子栏目`}
          title={open ? "收起" : "展开"}
          onClick={() => setOpen((v) => !v)}
          className="mr-2 rounded-md p-1.5 hover:bg-white/15"
        >
          <ChevronDown
            className={cn("size-4 transition-transform", !open && "-rotate-90")}
          />
        </button>
      </div>

      {open && (
        <div className="mt-0.5 flex flex-col gap-0.5 pl-6">
          {subNav.map((sub) => {
            const active = pathname === sub.href;
            return (
              <Link
                key={sub.href}
                href={sub.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-9 items-center rounded-lg px-3 text-sm transition-colors",
                  active
                    ? "bg-card font-semibold text-primary shadow-sm"
                    : "text-muted hover:bg-card hover:text-ink-2",
                )}
              >
                {sub.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
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
        <ExpandableNav
          href="/agents"
          label="AI 助手"
          icon={Sparkles}
          subNav={AGENT_SUB_NAV}
        />
        <ExpandableNav
          href="/knowledge"
          label="知识库"
          icon={Library}
          subNav={KNOWLEDGE_SUB_NAV}
        />
        {RESEARCH_NAV_AFTER.map((item) => (
          <NavLink key={item.label} item={item} />
        ))}
        <ExpandableNav
          href="/submit"
          label="投稿"
          icon={Send}
          subNav={SUBMIT_SUB_NAV}
        />
        <p className="px-3 pb-1.5 pt-4 text-[11px] font-medium tracking-wide text-faint">
          历史
        </p>
        {HISTORY_NAV.map((item) => (
          <NavLink key={item.label} item={item} />
        ))}
      </nav>

      {/* 设置 */}
      <div className="mt-4">
        <NavLink
          item={{ href: "/settings", label: "设置", icon: Settings, disabled: true }}
        />
      </div>

      {/* 用户卡片 */}
      <div className="mt-2 flex items-center gap-2.5 rounded-xl bg-card p-2.5 shadow-card">
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

      {/* 联系我们 */}
      <p className="mt-3 text-center text-[10px] leading-none text-faint">
        联系我们
      </p>
    </aside>
  );
}
