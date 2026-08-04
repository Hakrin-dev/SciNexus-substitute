"use client";

import { useEffect, useState } from "react";
import {
  BarChart3,
  Bell,
  Bot,
  CircleUserRound,
  GraduationCap,
  KeyRound,
  Monitor,
  Moon,
  Newspaper,
  Palette,
  Settings,
  Sparkles,
  Sun,
  UserRound,
} from "lucide-react";
import { useThemeStore, type ThemeMode } from "@/stores/theme";
import { cn } from "@/lib/utils";

/** 设置选项(原型阶段仅展示,未接页面) */
const MENU_ITEMS = [
  { label: "个人资料", icon: UserRound },
  { label: "账户", icon: CircleUserRound },
  { label: "订阅", icon: Sparkles },
  { label: "用量", icon: BarChart3 },
  { label: "助手", icon: Bot },
  { label: "外观", icon: Palette },
  { label: "动态", icon: Newspaper },
  { label: "通知", icon: Bell },
  { label: "Google 学术", icon: GraduationCap },
  { label: "API 密钥", icon: KeyRound },
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
  // persist 的主题在客户端水合后才可读,避免水合不一致
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="group relative mt-4 shrink-0">
      <button
        type="button"
        title="设置"
        className={cn(
          "flex h-10 w-full items-center gap-3 rounded-xl text-ink-2 transition-colors hover:bg-card",
          collapsed ? "justify-center" : "px-3",
        )}
      >
        <Settings className="size-[18px] shrink-0" strokeWidth={1.8} />
        {!collapsed && <span className="flex-1 text-left text-[15px] font-medium">设置</span>}
      </button>

      {/* 悬停选项栏:出现在条目右侧,底部对齐向上展开 */}
      <div className="pointer-events-none absolute bottom-0 left-full z-50 pl-2 opacity-0 transition-opacity duration-100 group-hover:pointer-events-auto group-hover:opacity-100">
        <div className="w-52 rounded-2xl border border-line bg-card p-2 shadow-pop">
          {MENU_ITEMS.map((item) => (
            <button
              key={item.label}
              type="button"
              className="flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-sm text-ink-2 transition-colors hover:bg-chip"
            >
              <item.icon className="size-4 shrink-0 text-muted" strokeWidth={1.8} />
              {item.label}
            </button>
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
