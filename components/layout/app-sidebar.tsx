"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import {
  Archive,
  ChevronDown,
  Compass,
  History,
  Library,
  LogOut,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Send,
  User,
  Wrench,
} from "lucide-react";
import { PromptCircle } from "@/components/icons/prompt-circle";
import { WorkbenchGrid } from "@/components/icons/workbench-grid";
import { cn } from "@/lib/utils";
import { SITE } from "@/lib/constants";
import { useProjects } from "@/lib/api/services";
import { useSidebarStore } from "@/stores/sidebar";
import { useAuthStore } from "@/stores/auth";
import { Logo } from "./logo";
import { SettingsMenu } from "./settings-menu";
import { LoginModal } from "@/components/auth/login-modal";
import { scholarDirections } from "@/lib/data/scholars";
import { libraryFolders } from "@/lib/data/library";

interface NavItem {
  href: string;
  label: string;
  icon: typeof Compass;
  badge?: string;
  disabled?: boolean;
  /** 前缀匹配(用于详情页保持高亮) */
  matchPrefix?: string;
}

interface SubNavItem {
  href: string;
  label: string;
  /** 无对应页面时禁用(即将上线) */
  disabled?: boolean;
}

/** 学者关系研究方向计数（「全部」= 方向总和,与 direction-filter 原逻辑一致） */
const SCHOLARS_TOTAL = scholarDirections.reduce((sum, d) => {
  const v = Number.parseFloat(d.count);
  return sum + (d.count.toLowerCase().includes("k") ? v * 1000 : v);
}, 0);

/** 「发现」的二级结构：学者（可展开研究方向）/ 机构（普通跳转） */
const DISCOVER_SCHOLAR_HREF = "/knowledge/scholars";
const DISCOVER_INSTITUTION_HREF = "/knowledge/institutions";
/** 学者下方三级研究方向（全部 + scholarDirections）。「全部」不传 dir query。 */
const SCHOLAR_DIRECTION_ITEMS = [
  { name: "全部", count: SCHOLARS_TOTAL, color: "primary" as const, query: null as string | null },
  ...scholarDirections.map((d) => ({ ...d, query: d.name })),
];
/** 学者下研究方向展开/收起在 sidebarStore 里用的 key（避免与路径冲突） */
const SCHOLAR_SUB_EXPANDED_KEY = "discover:scholars";

/** 「知识库 → 论文」结构：可展开显示文件夹列表 */
const PAPERS_HREF = "/knowledge/papers";
const PAPERS_SUB_EXPANDED_KEY = "knowledge:papers";
/** 论文默认文件夹：URL 无 ?folder= 时使用的默认值（对应原 LibraryPanel active 初始） */
const PAPERS_DEFAULT_FOLDER = "在读";
/** 知识库其余二级：笔记 / 记忆 / 数据库 */
const KNOWLEDGE_OTHER_SUB_NAV: SubNavItem[] = [
  { href: "/knowledge/notes", label: "笔记" },
  { href: "/knowledge/memory", label: "记忆" },
  { href: "/knowledge/database", label: "数据库" },
];

const RESEARCH_NAV: NavItem[] = [
  // AI 助手无子栏目,用前缀匹配让 /agents/deep-search 等子页保持高亮
  { href: "/agents", label: "AI 助手", icon: PromptCircle, matchPrefix: "/agents" },
];

/** 「知识库」的副标题 —— 保留常量以免别处引用（实际展示改用 customSubContent） */
const KNOWLEDGE_SUB_NAV: SubNavItem[] = [
  { href: "/knowledge/papers", label: "论文" },
  { href: "/knowledge/notes", label: "笔记" },
  { href: "/knowledge/memory", label: "记忆" },
  { href: "/knowledge/database", label: "数据库" },
];

/** 「工具库」的副标题 */
const TOOLS_SUB_NAV: SubNavItem[] = [
  { href: "/tools/skills", label: "技能" },
  { href: "/tools/plugins", label: "插件" },
  { href: "/tools/mcp", label: "MCP" },
];

/** 「投稿」为单页(会议 / 期刊 在页内切换),精确匹配——/submit/history 归属「投稿历史」 */
const SUBMIT_NAV: NavItem = {
  href: "/submit",
  label: "投稿",
  icon: Send,
};

/** 「投稿历史」即原投稿页的 History 视图(/submit/history) */
const HISTORY_NAV: NavItem[] = [
  { href: "/history", label: "浏览记录", icon: History },
  { href: "/my-projects", label: "归档项目", icon: Archive },
  { href: "/submit/history", label: "投稿历史", icon: Send, matchPrefix: "/submit/history" },
];

/**
 * 「发现 → 学者」二级条目：
 * - 点击标题跳转 /knowledge/scholars（全部），
 * - 右侧箭头单独控制三级「研究方向」列表展开/收起，
 * - 选中态：pathname 在学者路由下即高亮；当前 dir 对应条目额外高亮。
 */
function ScholarSubNav({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const setCollapsed = useSidebarStore((s) => s.setCollapsed);
  const setExpanded = useSidebarStore((s) => s.setExpanded);
  const expandedStorage = useSidebarStore((s) => s.expanded);
  // 学者路由下默认展开研究方向列表
  const onScholarsRoute = pathname.startsWith(DISCOVER_SCHOLAR_HREF);
  const open = expandedStorage[SCHOLAR_SUB_EXPANDED_KEY] ?? onScholarsRoute;
  const labelActive = onScholarsRoute;

  if (collapsed) {
    return (
      <button
        type="button"
        title="学者"
        onClick={() => {
          setCollapsed(false);
          setExpanded(SCHOLAR_SUB_EXPANDED_KEY, true);
          setExpanded("/", true);
          router.push(DISCOVER_SCHOLAR_HREF);
        }}
        className={cn(
          "h-9 shrink-0 rounded-lg text-sm transition-colors",
          labelActive ? "bg-card font-semibold text-primary" : "text-muted hover:bg-card hover:text-ink-2",
          "w-full",
        )}
        style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        学
      </button>
    );
  }

  return (
    <div className="shrink-0">
      <div className="flex h-9 items-center rounded-lg transition-colors">
        <Link
          href={DISCOVER_SCHOLAR_HREF}
          aria-current={labelActive ? "page" : undefined}
          onClick={() => setCollapsed(false)}
          className={cn(
            "flex h-full min-w-0 flex-1 items-center rounded-lg px-3 text-sm transition-colors",
            labelActive
              ? "bg-card font-semibold text-primary shadow-sm"
              : "text-muted hover:bg-card hover:text-ink-2",
          )}
        >
          学者
        </Link>
        <button
          type="button"
          aria-label={open ? "收起学者研究方向" : "展开学者研究方向"}
          title={open ? "收起" : "展开"}
          onClick={() => {
            setCollapsed(false);
            setExpanded(SCHOLAR_SUB_EXPANDED_KEY, !open);
            if (!labelActive) setExpanded("/", true);
          }}
          className="mr-1 rounded-md p-1 text-faint transition-colors hover:bg-chip hover:text-ink-2"
        >
          <ChevronDown
            className={cn("size-3.5 transition-transform", !open && "-rotate-90")}
          />
        </button>
      </div>
      {open && (
        <ul className="mt-0.5 flex flex-col gap-0.5 pl-6">
          {SCHOLAR_DIRECTION_ITEMS.map((item) => {
            const currentDir = searchParams.get("dir");
            const active = onScholarsRoute
              ? item.query === null
                ? currentDir === null || currentDir === ""
                : currentDir === item.query
              : false;
            const href =
              item.query === null
                ? DISCOVER_SCHOLAR_HREF
                : `${DISCOVER_SCHOLAR_HREF}?dir=${encodeURIComponent(item.query)}`;
            const swatchColor = item.color === "primary" ? undefined : (item.color as string);
            return (
              <li key={item.name}>
                <Link
                  href={href}
                  aria-pressed={active}
                  onClick={() => setCollapsed(false)}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors",
                    active ? "bg-primary-soft font-medium text-primary" : "text-ink-2 hover:bg-chip",
                  )}
                >
                  <span
                    className={cn(
                      "size-3.5 shrink-0 rounded-[4px]",
                      active ? "bg-primary" : "bg-ink-2/70",
                    )}
                    style={swatchColor && !active ? { backgroundColor: swatchColor } : undefined}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate text-left">{item.name}</span>
                  <span
                    className={cn(
                      "shrink-0 text-[11px]",
                      active
                        ? "rounded-full bg-primary px-1.5 py-0.5 leading-none text-white"
                        : "text-faint",
                    )}
                  >
                    {item.count}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * 「知识库 → 论文」二级条目：
 * - 点击标题跳转 /knowledge/papers（默认文件夹「在读」），
 * - 右侧箭头单独控制三级「文件夹列表」展开/收起，
 * - 过滤联动：?folder=（默认=在读）。
 */
function PaperSubNav({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const setCollapsed = useSidebarStore((s) => s.setCollapsed);
  const setExpanded = useSidebarStore((s) => s.setExpanded);
  const expandedStorage = useSidebarStore((s) => s.expanded);
  const onPapersRoute = pathname.startsWith(PAPERS_HREF);
  const open = expandedStorage[PAPERS_SUB_EXPANDED_KEY] ?? onPapersRoute;
  const labelActive = onPapersRoute;

  /** 跳转时只保留当前 ?tag=（标签在主内容区筛选，切换文件夹时保留它） */
  const buildHref = ({ folder }: { folder?: string | null }) => {
    const params = new URLSearchParams();
    const f = folder ?? searchParams.get("folder") ?? PAPERS_DEFAULT_FOLDER;
    const t = searchParams.get("tag");
    if (f && f !== PAPERS_DEFAULT_FOLDER) params.set("folder", f);
    if (t) params.set("tag", t);
    const qs = params.toString();
    return qs ? `${PAPERS_HREF}?${qs}` : PAPERS_HREF;
  };

  if (collapsed) {
    return (
      <button
        type="button"
        title="论文"
        onClick={() => {
          setCollapsed(false);
          setExpanded(PAPERS_SUB_EXPANDED_KEY, true);
          setExpanded("/knowledge", true);
          router.push(buildHref({ folder: null }));
        }}
        className={cn(
          "h-9 shrink-0 rounded-lg text-sm transition-colors",
          labelActive ? "bg-card font-semibold text-primary" : "text-muted hover:bg-card hover:text-ink-2",
          "w-full",
        )}
        style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        论
      </button>
    );
  }

  const currentFolder = searchParams.get("folder") ?? PAPERS_DEFAULT_FOLDER;

  return (
    <div className="shrink-0">
      <div className="flex h-9 items-center rounded-lg transition-colors">
        <Link
          href={buildHref({ folder: null })}
          aria-current={labelActive ? "page" : undefined}
          onClick={() => setCollapsed(false)}
          className={cn(
            "flex h-full min-w-0 flex-1 items-center rounded-lg px-3 text-sm transition-colors",
            labelActive
              ? "bg-card font-semibold text-primary shadow-sm"
              : "text-muted hover:bg-card hover:text-ink-2",
          )}
        >
          论文
        </Link>
        <button
          type="button"
          aria-label={open ? "收起论文子项" : "展开论文子项"}
          title={open ? "收起" : "展开"}
          onClick={() => {
            setCollapsed(false);
            setExpanded(PAPERS_SUB_EXPANDED_KEY, !open);
            if (!labelActive) setExpanded("/knowledge", true);
          }}
          className="mr-1 rounded-md p-1 text-faint transition-colors hover:bg-chip hover:text-ink-2"
        >
          <ChevronDown
            className={cn("size-3.5 transition-transform", !open && "-rotate-90")}
          />
        </button>
      </div>
      {open && (
        <div className="mt-0.5 flex flex-col gap-1 pl-6">
          {/* 文件夹列表（上方「新建文件夹」小按钮，语义与 LibraryPanel 一致） */}
          <button
            type="button"
            onClick={() => {
              setCollapsed(false);
              if (!onPapersRoute) router.push(buildHref({ folder: null, tag: null }));
            }}
            className="mt-1 mb-1 flex h-8 items-center justify-center gap-1 rounded-lg border border-dashed border-line bg-transparent text-[12px] font-medium text-muted transition-colors hover:border-primary/50 hover:bg-primary-soft/50 hover:text-primary"
          >
            <Plus className="size-3.5" />
            新建文件夹
          </button>
          <ul className="flex flex-col gap-0.5">
            {libraryFolders.map((folder) => {
              const active = onPapersRoute && currentFolder === folder.name;
              const href = buildHref({ folder: folder.name });
              return (
                <li key={folder.name}>
                  <Link
                    href={href}
                    aria-pressed={active}
                    onClick={() => setCollapsed(false)}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors",
                      active ? "bg-primary-soft font-medium text-primary" : "text-ink-2 hover:bg-chip",
                    )}
                  >
                    <span
                      className={cn(
                        "size-3.5 shrink-0 rounded-[4px]",
                        active ? "bg-primary" : "bg-ink-2/70",
                      )}
                      style={!active ? { backgroundColor: folder.color } : undefined}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate text-left">{folder.name}</span>
                    <span
                      className={cn(
                        "shrink-0 text-[11px]",
                        active
                          ? "rounded-full bg-primary px-1.5 py-0.5 leading-none text-white"
                          : "text-faint",
                      )}
                    >
                      {folder.count}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

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
 * 可展开导航项(发现 / 知识库 / 课题工作台 / 工具库)—— 展开状态存于全局 store。
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
  badge,
  noNav,
  matchPrefixes,
  excludePrefixes,
  customSubContent,
}: {
  href: string;
  label: string;
  icon: typeof Compass;
  subNav: SubNavItem[];
  collapsed: boolean;
  /** 子栏目列表末尾的附加内容(如「新建项目」) */
  footer?: React.ReactNode;
  badge?: string;
  /** 主标题无对应页面:点击只展开副标题,不跳转 */
  noNav?: boolean;
  /** 额外的高亮前缀(如「发现」附带学者/机构页) */
  matchPrefixes?: string[];
  /** 从 href 前缀匹配中排除的路径(如「知识库」不含学者/机构页) */
  excludePrefixes?: string[];
  /** 自定义展开内容:传入时替换默认的 subNav 数组渲染(footer 仍会追加在末尾) */
  customSubContent?: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const excluded =
    excludePrefixes?.some((p) => pathname.startsWith(p)) ?? false;
  const routeActive =
    (href === "/"
      ? pathname === "/"
      : pathname.startsWith(href) && !excluded) ||
    (matchPrefixes?.some((p) => pathname.startsWith(p)) ?? false);
  const stored = useSidebarStore((s) => s.expanded[href]);
  const setExpanded = useSidebarStore((s) => s.setExpanded);
  const setCollapsed = useSidebarStore((s) => s.setCollapsed);
  const open = stored ?? routeActive;
  /** 主页是否独立于副标题(如 AI 助手:/agents 不是任何副标题页) */
  const hasOwnPage =
    subNav.length > 0 ? !subNav.some((s) => s.href === href) : true;
  /** 跳转目标:有主标题页跳主标题页,没有则跳第一个可用副标题页(customSubContent 时直接用 href) */
  const dest = customSubContent
    ? href
    : hasOwnPage
      ? href
      : (subNav.find((s) => !s.disabled)?.href ?? href);

  /** 点击主标题:展开侧边栏与副标题,并按跳转规则跳转 */
  const handleMainClick = () => {
    setCollapsed(false);
    if (!open) setExpanded(href, true);
    if (!noNav && pathname !== dest) router.push(dest);
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
          if (!noNav && pathname !== dest) router.push(dest);
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
          {badge && (
            <span className="rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
              {badge}
            </span>
          )}
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
          {customSubContent ??
            subNav.map((sub) => {
              const active = pathname === sub.href;
              if (sub.disabled) {
                return (
                  <span
                    key={sub.href}
                    title="即将上线"
                    className="flex h-9 cursor-not-allowed items-center rounded-lg px-3 text-sm text-muted/50"
                  >
                    {sub.label}
                  </span>
                );
              }
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
/** 导航区滚动位置(App Router 每次导航会重挂载侧边栏,用它跨挂载恢复,避免点击后跳回顶部) */
let savedNavScrollTop = 0;

export function AppSidebar() {
  const collapsed = useSidebarStore((s) => s.collapsed);
  const toggleCollapsed = useSidebarStore((s) => s.toggleCollapsed);
  const userName = useAuthStore((s) => s.userName);
  const [loginOpen, setLoginOpen] = React.useState(false);
  const [logoutOpen, setLogoutOpen] = React.useState(false);
  const navScrollRef = React.useRef<HTMLElement | null>(null);
  const pathname = usePathname();

  // 重挂载时在提交阶段(paint 前)恢复滚动位置,避免先画 0 位再跳转的闪烁

  // 支持 /?login=1 直开登录弹窗(忘记密码页「返回登录」等入口)
  React.useEffect(() => {
    if (new URLSearchParams(window.location.search).get("login") !== "1") return;
    const url = new URL(window.location.href);
    url.searchParams.delete("login");
    window.history.replaceState({}, "", url.toString());
    // 延迟到下一帧打开,避免在 effect 内同步 setState
    const timer = window.setTimeout(() => setLoginOpen(true), 0);
    return () => window.clearTimeout(timer);
  }, []);
  const { data: projects = [] } = useProjects();
  const projectSubNav = projects
    .filter((p) => p.status === "进行中")
    .map((p) => ({
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

      <nav
        ref={(el) => {
          navScrollRef.current = el;
          // ref 回调在提交阶段执行(paint 前),滚动恢复对用户无感
          if (el && savedNavScrollTop > 0) el.scrollTop = savedNavScrollTop;
        }}
        onScroll={(e) => {
          savedNavScrollTop = e.currentTarget.scrollTop;
        }}
        className="scrollbar-subtle mt-4 flex flex-1 flex-col gap-0.5 overflow-y-auto"
      >
        {!collapsed && (
          <p className="shrink-0 px-3 pb-1.5 pt-2 text-[11px] font-medium tracking-wide text-faint">
            研究
          </p>
        )}
        <ExpandableNav
          href="/"
          label="发现"
          icon={Compass}
          subNav={[]}
          collapsed={collapsed}
          badge="新"
          matchPrefixes={["/knowledge/scholars", "/knowledge/institutions", "/scholars"]}
          customSubContent={
            collapsed ? (
              // 折叠态的 发现 点击箭头打开详情展开,这里就不显示副标题(图标栏)
              <></>
            ) : (
              <>
                <ScholarSubNav collapsed={collapsed} />
                <Link
                  href={DISCOVER_INSTITUTION_HREF}
                  aria-current={pathname.startsWith(DISCOVER_INSTITUTION_HREF) ? "page" : undefined}
                  className="flex h-9 items-center rounded-lg px-3 text-sm transition-colors text-muted hover:bg-card hover:text-ink-2 data-[current=true]:bg-card data-[current=true]:font-semibold data-[current=true]:text-primary data-[current=true]:shadow-sm"
                >
                  机构
                </Link>
              </>
            )
          }
        />
        {RESEARCH_NAV.map((item) => (
          <NavLink key={item.label} item={item} collapsed={collapsed} />
        ))}
        <ExpandableNav
          href="/projects"
          label="课题工作台"
          icon={WorkbenchGrid}
          subNav={projectSubNav}
          collapsed={collapsed}
          footer={
            <Link
              href="/projects/new"
              className="flex h-9 items-center gap-2 rounded-lg px-3 text-sm text-primary transition-colors hover:bg-card"
            >
              <Plus className="size-3.5" />
              新建项目
            </Link>
          }
        />
        <NavLink item={SUBMIT_NAV} collapsed={collapsed} />
        {!collapsed && (
          <p className="shrink-0 px-3 pb-1.5 pt-4 text-[11px] font-medium tracking-wide text-faint">
            库
          </p>
        )}
        <ExpandableNav
          href="/knowledge"
          label="知识库"
          icon={Library}
          subNav={[]}
          collapsed={collapsed}
          excludePrefixes={["/knowledge/scholars", "/knowledge/institutions"]}
          customSubContent={
            collapsed ? (
              <></>
            ) : (
              <>
                <PaperSubNav collapsed={collapsed} />
                {KNOWLEDGE_OTHER_SUB_NAV.map((sub) => {
                  const active = pathname === sub.href;
                  if (sub.disabled) {
                    return (
                      <span
                        key={sub.href}
                        title="即将上线"
                        className="flex h-9 cursor-not-allowed items-center rounded-lg px-3 text-sm text-muted/50"
                      >
                        {sub.label}
                      </span>
                    );
                  }
                  return (
                    <Link
                      key={sub.href}
                      href={sub.href}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setCollapsed?.(false)}
                      className="flex h-9 items-center rounded-lg px-3 text-sm transition-colors text-muted hover:bg-card hover:text-ink-2 data-[current=true]:bg-card data-[current=true]:font-semibold data-[current=true]:text-primary data-[current=true]:shadow-sm"
                    >
                      {sub.label}
                    </Link>
                  );
                })}
              </>
            )
          }
        />
        <ExpandableNav
          href="/tools"
          label="工具库"
          icon={Wrench}
          subNav={TOOLS_SUB_NAV}
          collapsed={collapsed}
          noNav
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
