"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import {
  ChevronDown,
  Compass,
  Folder,
  FolderOpen,
  History,
  Library,
  LogOut,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Send,
  User,
} from "lucide-react";
import { PromptCircle } from "@/components/icons/prompt-circle";
import { cn } from "@/lib/utils";
import { SITE } from "@/lib/constants";
import { useProjects } from "@/lib/api/services";
import { useSidebarStore } from "@/stores/sidebar";
import { useAuthStore } from "@/stores/auth";
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
  // AI 助手无子栏目,用前缀匹配让 /agents/deep-search 等子页保持高亮
  { href: "/agents", label: "AI 助手", icon: PromptCircle, matchPrefix: "/agents" },
];

/** 「投稿」为单页(会议 / 期刊 / 投递历史 在页内切换),用前缀匹配保持高亮 */
const SUBMIT_NAV: NavItem = {
  href: "/submit",
  label: "投稿",
  icon: Send,
  matchPrefix: "/submit",
};

/** 「知识库」的子栏目 */
const KNOWLEDGE_SUB_NAV = [
  { href: "/knowledge/papers", label: "论文库" },
  { href: "/knowledge/scholars", label: "学者关系" },
  { href: "/knowledge/institutions", label: "研究机构" },
];

/** 「科研项目」的子栏目即用户创建的项目列表(副标题 = 项目名称) */
const HISTORY_NAV: NavItem[] = [
  { href: "/history", label: "搜索", icon: History, disabled: true },
  { href: "/my-projects", label: "项目", icon: FolderOpen, disabled: true },
];

function NavLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const pathname = usePathname();
  const setCollapsed = useSidebarStore((s) => s.setCollapsed);
  const active = item.matchPrefix
    ? pathname.startsWith(item.matchPrefix)
    : pathname === item.href;
  const Icon = item.icon;
  /** 折叠规则:普通栏目(发现 / AI 助手 / 投稿 / 历史)点击后一律折叠侧边栏 */
  const collapseAlways = () => setCollapsed(true);

  const inner = (
    <>
      <Icon className="size-[18px] shrink-0" strokeWidth={1.8} />
      {!collapsed && (
        <span className="flex-1 text-[15px] font-medium">{item.label}</span>
      )}
      {!collapsed && item.badge && (
        <span className="rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
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

  // 折叠(图标栏)态:普通栏目点击仅跳转,不展开侧边栏
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
      onClick={collapseAlways}
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
 * 可展开导航项(知识库 / 科研项目)—— 展开状态存于全局 store。
 * 折叠/展开规则(与 NavLink / 设置菜单一致):
 * - 不论侧边栏当前展开与否,点击主标题或副标题都会展开侧边栏并展开副标题;
 * - 其他普通栏目点击后一律折叠(见 NavLink);
 * - 右侧箭头只收起/展开副标题,不跳转。
 */
function ExpandableNav({
  href,
  label,
  icon: Icon,
  subNav,
  collapsed,
  footer,
}: {
  href: string;
  label: string;
  icon: typeof Compass;
  subNav: { href: string; label: string }[];
  collapsed: boolean;
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
  /** 跳转目标:有主标题页跳主标题页,没有则跳第一个副标题页 */
  const dest = hasOwnPage ? href : subNav[0].href;

  /** 点击主标题:展开侧边栏与副标题,并按跳转规则跳转 */
  const handleMainClick = () => {
    setCollapsed(false);
    if (!open) setExpanded(href, true);
    if (pathname !== dest) router.push(dest);
  };

  if (collapsed) {
    return (
      <button
        type="button"
        title={label}
        onClick={() => {
          // 图标栏:点击可展开栏目 → 展开侧边栏并展开副标题
          setCollapsed(false);
          setExpanded(href, true);
          if (pathname !== dest) router.push(dest);
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
                onClick={() => {
                  // 副标题:保持侧边栏展开(不折叠)
                  setCollapsed(false);
                }}
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

/** 登录后「···」向上弹出的标签栏:登出 */
function LogoutPopup({ onClose }: { onClose: () => void }) {
  const logout = useAuthStore((s) => s.logout);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute bottom-full right-0 z-50 mb-2 w-28 rounded-xl border border-line bg-card p-1.5 shadow-pop"
    >
      <button
        type="button"
        onClick={() => {
          logout();
          onClose();
        }}
        className="flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-sm text-ink-2 transition-colors hover:bg-chip"
      >
        <LogOut className="size-4 text-muted" strokeWidth={1.8} />
        登出
      </button>
    </div>
  );
}

/** 全局侧边栏 —— 对应 SVG 原型 240px 左侧栏(背景 #EEF1F8),可折叠为 64px 图标栏 */
export function AppSidebar() {
  const collapsed = useSidebarStore((s) => s.collapsed);
  const toggleCollapsed = useSidebarStore((s) => s.toggleCollapsed);
  const userName = useAuthStore((s) => s.userName);
  const [loginOpen, setLoginOpen] = React.useState(false);
  const [logoutOpen, setLogoutOpen] = React.useState(false);
  const { data: projects = [] } = useProjects();
  const projectSubNav = projects.map((p) => ({
    href: `/projects/${p.id}`,
    label: p.name,
  }));

  const toggleBtn = (
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
  );

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 hidden flex-col bg-sidebar py-5 transition-[width] duration-200 lg:flex",
        collapsed ? "w-16 px-2" : "w-60 px-4",
      )}
    >
      {/* 展开态:SciNexus wordmark 居上,下方「研枢」与折叠键并列;折叠态:三十字星 + 展开键纵向排列 */}
      {collapsed ? (
        <div className="flex flex-col items-center gap-2">
          <Logo compact />
          {toggleBtn}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <Logo withName={false} />
          <div className="flex items-center justify-between">
            <span className="px-1 text-[15px] font-bold text-ink">
              {SITE.name}
            </span>
            {toggleBtn}
          </div>
        </div>
      )}

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
          href="/knowledge"
          label="知识库"
          icon={Library}
          subNav={KNOWLEDGE_SUB_NAV}
          collapsed={collapsed}
        />
        <ExpandableNav
          href="/projects"
          label="科研项目"
          icon={Folder}
          subNav={projectSubNav}
          collapsed={collapsed}
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
        <NavLink item={SUBMIT_NAV} collapsed={collapsed} />
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

      {/* 用户卡片:未登录点击弹出登录弹窗;登录后「···」向上弹出「登出」 */}
      {collapsed ? (
        <div className="relative mt-2 flex justify-center">
          <button
            type="button"
            aria-label={userName ? "账号菜单" : "登录"}
            className="flex size-9 cursor-pointer items-center justify-center rounded-full bg-primary-soft"
            onClick={() =>
              userName ? setLogoutOpen((v) => !v) : setLoginOpen(true)
            }
          >
            {userName ? (
              <span className="text-[13px] font-semibold text-primary">
                {userName.slice(0, 1)}
              </span>
            ) : (
              <User className="size-4.5 text-primary" />
            )}
          </button>
          {userName && logoutOpen && <LogoutPopup onClose={() => setLogoutOpen(false)} />}
        </div>
      ) : userName ? (
        <div className="relative mt-2">
          <div className="flex items-center gap-2.5 rounded-xl bg-card p-2.5 shadow-card">
            <span className="flex size-9 items-center justify-center rounded-full bg-primary-soft text-[13px] font-semibold text-primary">
              {userName.slice(0, 1)}
            </span>
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate text-[13px] font-semibold text-ink">
                {userName}
              </span>
            </span>
            <button
              type="button"
              aria-label="账号菜单"
              aria-expanded={logoutOpen}
              className="cursor-pointer rounded-md p-1 text-faint transition-colors hover:bg-chip hover:text-ink-2"
              onClick={() => setLogoutOpen((v) => !v)}
            >
              <MoreHorizontal className="size-4" />
            </button>
          </div>
          {logoutOpen && <LogoutPopup onClose={() => setLogoutOpen(false)} />}
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
          </span>
          <span aria-hidden className="rounded-md p-1 text-faint">
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
