"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  BarChart3,
  Bell,
  Bot,
  KeyRound,
  Monitor,
  Moon,
  Settings,
  Sun,
  UserRound,
} from "lucide-react";
import { useThemeStore, type ThemeMode } from "@/stores/theme";
import { cn } from "@/lib/utils";
import { useSidebarStore } from "@/stores/sidebar";

/** 设置选项,自上而下与设置页 Tab 顺序一致,点击跳转对应 Tab */
const MENU_ITEMS = [
  { label: "个人", icon: UserRound, href: "/settings?tab=profile" },
  { label: "用量统计", icon: BarChart3, href: "/settings?tab=usage" },
  { label: "Agent设置", icon: Bot, href: "/settings?tab=agent" },
  { label: "API Keys", icon: KeyRound, href: "/settings?tab=api" },
  { label: "通知", icon: Bell, href: "/settings?tab=notifications" },
];

const THEME_OPTIONS: { mode: ThemeMode; label: string; icon: typeof Sun }[] = [
  { mode: "light", label: "日间", icon: Sun },
  { mode: "dark", label: "夜间", icon: Moon },
  { mode: "system", label: "跟随系统", icon: Monitor },
];

/** 设置条目 + 悬停展开的选项栏,栏底为日/夜/跟随系统切换 */
export function SettingsMenu({ collapsed }: { collapsed: boolean }) {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  // persist 的主题在客户端水合后才可读,避免水合不一致
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const setCollapsed = useSidebarStore((s) => s.setCollapsed);
  const closeMenu = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) closeMenu();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative mt-4 shrink-0">
      {collapsed ? (
        <button
          type="button"
          title="设置"
          aria-label="设置"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex h-10 w-full items-center justify-center rounded-xl text-ink-2 transition-colors hover:bg-card"
        >
          <Settings className="size-[18px] shrink-0" strokeWidth={1.8} />
        </button>
      ) : (
        <button
          type="button"
          title="设置"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-ink-2 transition-colors hover:bg-card"
        >
          <Settings className="size-[18px] shrink-0" strokeWidth={1.8} />
          <span className="flex-1 text-left text-[15px] font-medium">设置</span>
        </button>
      )}

      {/* 设置选项栏:点击打开,底部对齐向上展开 */}
      <div
        className={cn(
          "absolute bottom-0 left-full z-50 pl-2 transition-opacity duration-100",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <div className="w-52 rounded-2xl border border-line bg-card p-2 shadow-pop">
          {MENU_ITEMS.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => {
                setCollapsed(false);
                closeMenu();
              }}
              className="flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-sm text-ink-2 transition-colors hover:bg-chip"
            >
              <item.icon className="size-4 shrink-0 text-muted" strokeWidth={1.8} />
              {item.label}
            </Link>
          ))}

          {/* 主题:日间 / 夜间 / 跟随系统 */}
          <div className="mt-1.5 flex items-center gap-1 border-t border-line px-1 pb-1 pt-2.5">
            {THEME_OPTIONS.map((opt) => (
              <button
                key={opt.mode}
                type="button"
                title={opt.label}
                aria-label={opt.label}
                aria-pressed={mounted && mode === opt.mode}
                onClick={() => setMode(opt.mode)}
                className={cn(
                  "flex h-8 flex-1 cursor-pointer items-center justify-center rounded-lg transition-colors",
                  mounted && mode === opt.mode
                    ? "bg-primary-soft text-primary"
                    : "text-muted hover:bg-chip hover:text-ink-2",
                )}
              >
                <opt.icon className="size-4" strokeWidth={1.8} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
