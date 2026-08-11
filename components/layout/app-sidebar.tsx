"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import {
  ChevronDown,
  Compass,
  Folder,
  History,
  Layers,
  Library,
  MessageSquare,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Send,
  Sparkles,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SITE } from "@/lib/constants";
import { projects } from "@/lib/data/projects";
import { useSidebarStore } from "@/stores/sidebar";
import { Logo } from "./logo";
import { SettingsMenu } from "./settings-menu";
import { LoginModal } from "@/components/auth/login-modal";

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

/** 「科研项目」的子栏目即用户创建的项目列表(副标题 = 项目名称) */
const PROJECT_SUB_NAV = projects.map((p) => ({
  href: `/projects/${p.id}`,
  label: p.name,
}));

const HISTORY_NAV: NavItem[] = [
  { href: "/history", label: "搜索", icon: History, disabled: true },
  { href: "/qa", label: "研究", icon: MessageSquare, disabled: true },
  { href: "/my-projects", label: "项目", icon: Folder, disabled: true },
  { href: "/deliveries", label: "投递", icon: Send, disabled: true },
];

function NavLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const pathname = usePathname();
  const setCollapsed = useSidebarStore((s) => s.setCollapsed);
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

  // “发现”等无子菜单入口在图标栏状态下直接跳转，不经过展开面板。
  if (collapsed) {
    return (
      <Link
        href={item.href}
        title={item.label}
        aria-label={item.label}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex h-10 shrink-0 items-center justify-center rounded-xl transition-colors",
          active
            ? "bg-primary text-white shadow-sm"
            : "text-ink-2 hover:bg-card",
        )}
      >
        <Icon className="size-[18px] shrink-0" strokeWidth={1.8} />
      </Link>
    );
  }

  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      aria-current={active ? "page" : undefined}
      onClick={() => setCollapsed(true)}
      className={cn(
        "flex h-10 shrink-0 items-center rounded-xl transition-colors",
        "gap-3 px-3",
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
 * 图标栏状态下点击任意主栏目只展开侧栏与对应子栏目,不立即导航。
 * 展开后点击具体栏目/子栏目完成导航并自动收回为图标栏。
 * 特例:主页独立于副标题的栏目(如 AI 助手,/agents 不是副标题页),
 * 在副标题页点击先切回主页,再次点击才收起。
 * 右侧箭头只收起/展开,不跳转。
 * toggleOnly(科研项目):主体只展开/收起,绝不跳转;此时侧边栏图标态点击
 * 改为展开整个侧边栏并展开子栏目。
 * 除 toggleOnly 外,点击标题/副标题跳转后侧边栏默认折叠为图标栏。
 */
function ExpandableNav({
  href,
  label,
  icon: Icon,
  subNav,
  collapsed,
  toggleOnly = false,
  footer,
}: {
  href: string;
  label: string;
  icon: typeof Compass;
  subNav: { href: string; label: string }[];
  collapsed: boolean;
  toggleOnly?: boolean;
  /** 子栏目列表末尾的附加内容(如「新建项目」) */
  footer?: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const routeActive = pathname.startsWith(href);
  const stored = useSidebarStore((s) => s.expanded[href]);
  const setExpanded = useSidebarStore((s) => s.setExpanded);
  const setCollapsed = useSidebarStore((s) => s.setCollapsed);
  const open = stored ?? routeActive;
  /** 主页是否独立于副标题(如 AI 助手:/agents 不是任何副标题页) */
  const hasOwnPage = !subNav.some((s) => s.href === href);

  const handleMainClick = () => {
    if (toggleOnly) {
      // 科研项目:仅展开/收起,不跳转
      setExpanded(href, !open);
      return;
    }
    if (!open) {
      setExpanded(href, true);
      router.push(href);
      setCollapsed(true);
    } else if (hasOwnPage && pathname !== href) {
      // 主页独立的栏目(AI 助手):在副标题页时先切回主页,再点才收起
      router.push(href);
      setCollapsed(true);
    } else {
      setExpanded(href, false);
    }
  };

  if (collapsed) {
    return (
      <button
        type="button"
        title={label}
        onClick={() => {
          // 所有主栏目统一:图标态第一次点击只展开侧栏和对应子栏目。
          setCollapsed(false);
          setExpanded(href, true);
        }}
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
                onClick={() => setCollapsed(true)}
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
          {footer}
        </div>
      )}
    </div>
  );
}

/** 全局侧边栏 —— 对应 SVG 原型 240px 左侧栏(背景 #EEF1F8),可折叠为 64px 图标栏 */
export function AppSidebar() {
  const collapsed = useSidebarStore((s) => s.collapsed);
  const toggleCollapsed = useSidebarStore((s) => s.toggleCollapsed);
  const [loginOpen, setLoginOpen] = React.useState(false);

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
        <ExpandableNav
          href="/projects"
          label="科研项目"
          icon={Layers}
          subNav={PROJECT_SUB_NAV}
          collapsed={collapsed}
          toggleOnly
          footer={
            <button
              type="button"
              title="新建项目(演示)"
              className="flex h-9 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm text-faint transition-colors hover:bg-card hover:text-ink-2"
            >
              <Plus className="size-3.5" />
              新建项目
            </button>
          }
        />
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

      {/* 用户卡片(未登录,点击弹出登录弹窗) */}
      {collapsed ? (
        <div className="mt-2 flex justify-center">
          <button
            type="button"
            aria-label="登录"
            className="flex size-9 cursor-pointer items-center justify-center rounded-full bg-primary-soft"
            onClick={() => setLoginOpen(true)}
          >
            <User className="size-4.5 text-primary" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="mt-2 flex cursor-pointer items-center gap-2.5 rounded-xl bg-card p-2.5 text-left shadow-card transition-colors hover:bg-chip"
          onClick={() => setLoginOpen(true)}
        >
          <span className="flex size-9 items-center justify-center rounded-full bg-primary-soft">
            <User className="size-4.5 text-primary" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="truncate text-[13px] font-semibold text-ink">
              {SITE.user.name}
            </span>
            {SITE.user.title && (
              <span className="truncate text-[11px] text-muted">
                {SITE.user.title}
              </span>
            )}
          </span>
          <span
            aria-hidden
            className="rounded-md p-1 text-faint"
          >
            <MoreHorizontal className="size-4" />
          </span>
        </button>
      )}

      {/* 联系我们 */}
      {!collapsed && (
        <p className="mt-3 text-center text-[10px] leading-none text-faint">
          联系我们
        </p>
      )}

      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </aside>
  );
}
