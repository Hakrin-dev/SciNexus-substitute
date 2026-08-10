"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Monitor, Moon, Sun } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useThemeStore, type ThemeMode } from "@/stores/theme";
import { useEffect, useState } from "react";

/** 设置页 Tab(顺序与侧边栏浮动标签栏一致) */
export const SETTINGS_TABS = [
  { value: "profile", label: "个人" },
  { value: "subscription", label: "订阅" },
  { value: "usage", label: "用量统计" },
  { value: "agent", label: "Agent设置" },
  { value: "api", label: "API设置" },
  { value: "appearance", label: "外观" },
  { value: "notifications", label: "通知" },
] as const;

const THEME_OPTIONS: { mode: ThemeMode; label: string; icon: typeof Sun }[] = [
  { mode: "light", label: "日间", icon: Sun },
  { mode: "dark", label: "夜间", icon: Moon },
  { mode: "system", label: "跟随系统", icon: Monitor },
];

/** 演示占位面板 */
function Placeholder({ text }: { text: string }) {
  return (
    <div className="rounded-2xl bg-card p-8 text-sm text-muted shadow-card">
      {text}
    </div>
  );
}

function AppearancePanel() {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="rounded-2xl bg-card p-6 shadow-card">
      <h3 className="text-sm font-semibold text-ink">主题模式</h3>
      <div className="mt-4 flex gap-2">
        {THEME_OPTIONS.map((opt) => (
          <button
            key={opt.mode}
            type="button"
            aria-pressed={mounted && mode === opt.mode}
            onClick={() => setMode(opt.mode)}
            className={cn(
              "flex h-10 cursor-pointer items-center gap-2 rounded-xl px-4 text-sm transition-colors",
              mounted && mode === opt.mode
                ? "bg-primary-soft text-primary"
                : "bg-chip text-ink-2 hover:text-ink",
            )}
          >
            <opt.icon className="size-4" strokeWidth={1.8} />
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** 设置页 Tab 容器,受控于 URL ?tab= 参数 */
export function SettingsTabs() {
  const router = useRouter();
  const params = useSearchParams();
  const tab = params.get("tab");
  const active = SETTINGS_TABS.some((t) => t.value === tab)
    ? (tab as string)
    : "profile";

  return (
    <Tabs
      value={active}
      onValueChange={(v) => router.replace(`/settings?tab=${v}`, { scroll: false })}
    >
      <TabsList className="border-b border-line">
        {SETTINGS_TABS.map((t) => (
          <TabsTrigger key={t.value} value={t.value}>
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="profile" className="mt-6">
        <Placeholder text="个人资料设置(演示占位)" />
      </TabsContent>
      <TabsContent value="subscription" className="mt-6">
        <Placeholder text="订阅方案管理(演示占位)" />
      </TabsContent>
      <TabsContent value="usage" className="mt-6">
        <Placeholder text="用量统计(演示占位)" />
      </TabsContent>
      <TabsContent value="agent" className="mt-6">
        <Placeholder text="Agent 设置(演示占位)" />
      </TabsContent>
      <TabsContent value="api" className="mt-6">
        <Placeholder text="API 密钥管理(演示占位)" />
      </TabsContent>
      <TabsContent value="appearance" className="mt-6">
        <AppearancePanel />
      </TabsContent>
      <TabsContent value="notifications" className="mt-6">
        <Placeholder text="通知偏好(演示占位)" />
      </TabsContent>
    </Tabs>
  );
}
