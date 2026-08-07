"use client";

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
  PanelLeftClose,
  PanelLeftOpen,
  Send,
  Sparkles,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SITE } from "@/lib/constants";
import { useSidebarStore } from "@/stores/sidebar";
import { Logo } from "./logo";
import { SettingsMenu } from "./settings-menu";

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

/** 「知识库」的子栏目 */
const KNOWLEDGE_SUB_NAV = [
  { href: "/knowledge/papers", label: "论文库" },
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

function NavLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const pathname = usePathname();
  const active = item.matchPrefix
    ? pathname.startsWith(item.matchPrefix)
    : pathname === item.href;
  const Icon = item.icon;

  const inner = (
    <>
      <Icon className="size-[18px] shrink-0" strokeWidth={1.8} />
      {!collapsed && (
        <span className="flex-1 text-[15px] font-medium">{item.label}</span>
      )}
      {!collapsed && item.badge && (
        <span className="rounded-full bg-brand-gold px-1.5 py-0.5 text-[10px] font-semibold leading-none text-ink">
          {item.badge}
        </span>
      )}
    </>
  );

  if (item.disabled) {
    return (
      <span
        title={collapsed ? `${item.label}(即将上线)` : "即将上线"}
        className={cn(
          "flex h-10 shrink-0 cursor-not-allowed items-center rounded-xl text-muted/50",
          collapsed ? "justify-center" : "gap-3 px-3",
        )}
      >
        {inner}
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-10 shrink-0 items-center rounded-xl transition-colors",
        collapsed ? "justify-center" : "gap-3 px-3",
        active
          ? "bg-primary text-white shadow-sm"
          : "text-ink-2 hover:bg-card",
      )}
    >
      {inner}
    </Link>
  );
}

/**
 * 可展开导航项 —— 展开状态存于全局 store,切换到其他条目后仍保持展开。
 * 点击主体:折叠时展开并进入主页;已展开时折叠收起。
 * 特例:主页独立于副标题的栏目(如 AI 助手,/agents 不是副标题页),
 * 在副标题页点击先切回主页,再次点击才收起。
 * 右侧箭头只收起/展开,不跳转。侧边栏折叠时仅显示图标,点击直接进入主页。
 */
function ExpandableNav({
  href,
  label,
  icon: Icon,
  subNav,
  collapsed,
}: {
  href: string;
  label: string;
  icon: typeof Compass;
  subNav: { href: string; label: string }[];
  collapsed: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const routeActive = pathname.startsWith(href);
  const stored = useSidebarStore((s) => s.expanded[href]);
  const setExpanded = useSidebarStore((s) => s.setExpanded);
  const open = stored ?? routeActive;
  /** 主页是否独立于副标题(如 AI 助手:/agents 不是任何副标题页) */
  const hasOwnPage = !subNav.some((s) => s.href === href);

  const handleMainClick = () => {
    if (!open) {
      setExpanded(href, true);
      router.push(href);
    } else if (hasOwnPage && pathname !== href) {
      // 主页独立的栏目(AI 助手):在副标题页时先切回主页,再点才收起
      router.push(href);
    } else {
      setExpanded(href, false);
    }
  };

  if (collapsed) {
    return (
      <button
        type="button"
        title={label}
        onClick={() => router.push(href)}
        className={cn(
          "flex h-10 shrink-0 items-center justify-center rounded-xl transition-colors",
          routeActive
            ? "bg-primary text-white shadow-sm"
            : "text-ink-2 hover:bg-card",
        )}
      >
        <Icon className="size-[18px] shrink-0" strokeWidth={1.8} />
      </button>
    );
  }

  return (
    <div className="shrink-0">
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
          onClick={handleMainClick}
          className="flex h-full min-w-0 flex-1 items-center gap-3 pl-3 text-left"
        >
          <Icon className="size-[18px] shrink-0" strokeWidth={1.8} />
          <span className="flex-1 text-[15px] font-medium">{label}</span>
        </button>
        <button
          type="button"
          aria-label={open ? `收起${label}子栏目` : `展开${label}子栏目`}
          title={open ? "收起" : "展开"}
          onClick={() => setExpanded(href, !open)}
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

/** 全局侧边栏 —— 对应 SVG 原型 240px 左侧栏(背景 #EEF1F8),可折叠为 64px 图标栏 */
export function AppSidebar() {
  const collapsed = useSidebarStore((s) => s.collapsed);
  const toggleCollapsed = useSidebarStore((s) => s.toggleCollapsed);

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 hidden flex-col bg-sidebar py-5 transition-[width] duration-200 lg:flex",
        collapsed ? "w-16 px-2" : "w-60 px-4",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2",
          collapsed ? "flex-col" : "justify-between",
        )}
      >
        <Logo compact={collapsed} />
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "展开侧边栏" : "折叠侧边栏"}
          title={collapsed ? "展开侧边栏" : "折叠侧边栏"}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-chip hover:text-ink"
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4" strokeWidth={1.8} />
          ) : (
            <PanelLeftClose className="size-4" strokeWidth={1.8} />
          )}
        </button>
      </div>

      <nav className="scrollbar-subtle mt-4 flex flex-1 flex-col gap-0.5 overflow-y-auto">
        {!collapsed && (
          <p className="shrink-0 px-3 pb-1.5 pt-2 text-[11px] font-medium tracking-wide text-faint">
            研究
          </p>
        )}
        {RESEARCH_NAV.map((item) => (
          <NavLink key={item.label} item={item} collapsed={collapsed} />
        ))}
        <ExpandableNav
          href="/agents"
          label="AI 助手"
          icon={Sparkles}
          subNav={AGENT_SUB_NAV}
          collapsed={collapsed}
        />
        <ExpandableNav
          href="/knowledge"
          label="知识库"
          icon={Library}
          subNav={KNOWLEDGE_SUB_NAV}
          collapsed={collapsed}
        />
        {RESEARCH_NAV_AFTER.map((item) => (
          <NavLink key={item.label} item={item} collapsed={collapsed} />
        ))}
        <ExpandableNav
          href="/submit"
          label="投稿"
          icon={Send}
          subNav={SUBMIT_SUB_NAV}
          collapsed={collapsed}
        />
        {!collapsed && (
          <p className="shrink-0 px-3 pb-1.5 pt-4 text-[11px] font-medium tracking-wide text-faint">
            历史
          </p>
        )}
        {HISTORY_NAV.map((item) => (
          <NavLink key={item.label} item={item} collapsed={collapsed} />
        ))}
      </nav>

      {/* 设置(悬停显示选项栏) */}
      <SettingsMenu collapsed={collapsed} />

      {/* 用户卡片 */}
      {collapsed ? (
        <div className="mt-2 flex justify-center">
          <span className="flex size-9 items-center justify-center rounded-full bg-primary-soft">
            <User className="size-4.5 text-primary" />
          </span>
        </div>
      ) : (
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
      )}

      {/* 联系我们 */}
      {!collapsed && (
        <p className="mt-3 text-center text-[10px] leading-none text-faint">
          联系我们
        </p>
      )}
    </aside>
  );
}
