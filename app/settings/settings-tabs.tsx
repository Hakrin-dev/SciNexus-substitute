"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Apple,
  Award,
  Bell,
  BarChart3,
  Bot,
  ChevronDown,
  ChevronRight,
  Chrome,
  Github,
  GraduationCap,
  KeyRound,
  Medal,
  Monitor,
  Moon,
  Newspaper,
  Smile,
  Sun,
  Trophy,
  User,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useThemeStore, type ThemeMode } from "@/stores/theme";

/**
 * MCP 图标:官方 logo 的结形路径,改为 currentColor 描边,
 * 与其他 lucide 图标同源同风格(随文字颜色变化)
 */
export function McpIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="10 24 166 166"
      fill="none"
      stroke="currentColor"
      strokeWidth={12}
      strokeLinecap="round"
      aria-hidden
      className={className}
    >
      <path d="M25 97.8528L92.8823 29.9706C102.255 20.598 117.451 20.598 126.823 29.9706V29.9706C136.196 39.3431 136.196 54.5391 126.823 63.9117L75.5581 115.177" />
      <path d="M76.2653 114.47L126.823 63.9117C136.196 54.5391 151.392 54.5391 160.765 63.9117L161.118 64.2652C170.491 73.6378 170.491 88.8338 161.118 98.2063L99.7248 159.6C96.6006 162.724 96.6006 167.789 99.7248 170.913L112.331 183.52" />
      <path d="M109.853 46.9411L59.6482 97.1457C50.2757 106.518 50.2757 121.714 59.6482 131.087V131.087C69.0208 140.459 84.2168 140.459 93.5894 131.087L143.794 80.8822" />
    </svg>
  );
}

/** 设置页 Tab(顺序与侧边栏浮动标签栏一致) */
export const SETTINGS_TABS = [
  { value: "profile", label: "个人", icon: UserRound },
  { value: "usage", label: "用量统计", icon: BarChart3 },
  { value: "agent", label: "Agent设置", icon: Bot },
  { value: "mcp", label: "MCP", icon: null },
  { value: "api", label: "API", icon: KeyRound },
  { value: "notifications", label: "通知", icon: Bell },
] as const;

const THEME_OPTIONS: { mode: ThemeMode; label: string; icon: typeof Sun }[] = [
  { mode: "light", label: "日间", icon: Sun },
  { mode: "dark", label: "夜间", icon: Moon },
  { mode: "system", label: "跟随系统", icon: Monitor },
];

const LANGUAGES = ["中文", "English"] as const;

const LINKED_ACCOUNTS = [
  { label: "Google Scholar", icon: GraduationCap, linked: true },
  { label: "Hugging Face", icon: Smile, linked: false },
  { label: "GitHub", icon: Github, linked: true },
  { label: "Google", icon: Chrome, linked: false },
  { label: "Apple", icon: Apple, linked: false },
];

const ACHIEVEMENTS = [
  {
    icon: Trophy,
    title: "CCF-A 类会议论文 8 篇",
    detail: "NeurIPS / ICML / CVPR,其中 2 篇 Oral",
  },
  {
    icon: Medal,
    title: "国家奖学金",
    detail: "博士研究生国家奖学金(2024)",
  },
  {
    icon: Award,
    title: "开源社区贡献者",
    detail: "主流深度学习框架 Committer,GitHub 3.2k Stars",
  },
];

const BIO = [
  "2016 年进入清华大学计算机科学与技术系,本科期间即加入知识工程实验室参与科研训练,获清华大学优良毕业生称号。",
  "2020 年起于清华大学人工智能研究院攻读博士学位,研究方向为大语言模型与知识增强,师从领域知名学者;博士期间以第一作者身份在 NeurIPS、ICML、CVPR 等顶会发表多篇论文。",
  "2024 年至今,专注于科研智能体(Research Agent)方向,致力于让 AI 参与文献调研、假设生成与实验设计的全流程。",
];

/** 分区标题 */
function SectionTitle({ children }: { children: string }) {
  return (
    <h3 className="text-[15px] font-semibold text-ink">{children}</h3>
  );
}

/** 简介:简历式学者画像大卡片 */
function ProfileCard() {
  return (
    <div className="mt-3 rounded-2xl bg-card p-7 shadow-card">
      {/* 上排:证件照比例照片位 + 主要成就 */}
      <div className="flex gap-7">
        {/* 照片位:3:4 证件照比例,以用户卡片 logo 占位 */}
        <div className="flex h-48 w-36 shrink-0 flex-col items-center justify-center gap-2 rounded-xl border border-line bg-primary-soft/40">
          <span className="flex size-14 items-center justify-center rounded-full bg-primary-soft">
            <User className="size-7 text-primary" />
          </span>
          <span className="text-[11px] text-faint">照片待上传</span>
        </div>

        {/* 主要成就 */}
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-muted">主要成就</p>
          <ul className="mt-3 space-y-3.5">
            {ACHIEVEMENTS.map((a) => (
              <li key={a.title} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft">
                  <a.icon className="size-4 text-primary" strokeWidth={1.8} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink">
                    {a.title}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted">
                    {a.detail}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 下排:主要生平 */}
      <div className="mt-7 border-t border-line pt-6">
        <p className="text-[13px] font-medium text-muted">主要生平</p>
        <div className="mt-3 space-y-3">
          {BIO.map((paragraph, i) => (
            <p key={i} className="text-sm leading-relaxed text-ink-2">
              {paragraph}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

/** 账户:基本信息 + 关联账号 */
function AccountSection() {
  return (
    <div className="mt-3 space-y-5 rounded-2xl bg-card p-7 shadow-card">
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink-2">用户名</span>
          <Input placeholder="未设置" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink-2">账号</span>
          <Input placeholder="邮箱或手机号" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink-2">密码</span>
          <Input type="password" placeholder="••••••••" />
        </label>
      </div>

      <div className="border-t border-line pt-5">
        <p className="text-[13px] font-medium text-ink-2">关联账号</p>
        <ul className="mt-3 divide-y divide-line">
          {LINKED_ACCOUNTS.map((acc) => (
            <li key={acc.label} className="flex items-center gap-3 py-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-chip">
                <acc.icon className="size-4.5 text-ink-2" strokeWidth={1.8} />
              </span>
              <span className="flex-1 text-sm text-ink">{acc.label}</span>
              <span className="text-xs text-faint">
                {acc.linked ? "已关联" : "未关联"}
              </span>
              <Button variant={acc.linked ? "outline" : "soft"} size="sm">
                {acc.linked ? "解除关联" : "关联"}
              </Button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** 语言:中文 / English */
function LanguageSection() {
  const [lang, setLang] = useState<(typeof LANGUAGES)[number]>("中文");
  return (
    <div className="mt-3 rounded-2xl bg-card p-7 shadow-card">
      <div className="flex gap-2">
        {LANGUAGES.map((l) => (
          <button
            key={l}
            type="button"
            aria-pressed={lang === l}
            onClick={() => setLang(l)}
            className={cn(
              "h-10 cursor-pointer rounded-xl px-5 text-sm transition-colors",
              lang === l
                ? "bg-primary-soft font-medium text-primary"
                : "bg-chip text-ink-2 hover:text-ink",
            )}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

/** 外观:日间 / 夜间 / 跟随系统 */
function AppearanceSection() {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="mt-3 rounded-2xl bg-card p-7 shadow-card">
      <div className="flex gap-2">
        {THEME_OPTIONS.map((opt) => (
          <button
            key={opt.mode}
            type="button"
            aria-pressed={mounted && mode === opt.mode}
            onClick={() => setMode(opt.mode)}
            className={cn(
              "flex h-10 cursor-pointer items-center gap-2 rounded-xl px-5 text-sm transition-colors",
              mounted && mode === opt.mode
                ? "bg-primary-soft font-medium text-primary"
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

/** 个人:简介 / 账户 / 语言 / 外观 */
function ProfilePanel() {
  return (
    <div className="space-y-8">
      <section>
        <SectionTitle>简介</SectionTitle>
        <ProfileCard />
      </section>
      <section>
        <SectionTitle>账户</SectionTitle>
        <AccountSection />
      </section>
      <section>
        <SectionTitle>语言</SectionTitle>
        <LanguageSection />
      </section>
      <section>
        <SectionTitle>外观</SectionTitle>
        <AppearanceSection />
      </section>
    </div>
  );
}

/** 通知条目(演示):主标题 + 开关 + 展开/折叠,副标题可选 */
const NOTIFICATION_ITEMS: {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  detail: string;
}[] = [
  {
    title: "动态通知",
    subtitle: "你关注/收藏的学者/机构的动态通知",
    icon: Newspaper,
    detail: "演示:何恺明 发表了新论文《…》;清华大学 AI Lab 发布了新动态。",
  },
  {
    title: "互动消息",
    subtitle: "与你互动的消息",
    icon: Users,
    detail: "演示:有学者认领了你关注的主页;你的收藏被推荐了。",
  },
  {
    title: "系统通知",
    icon: Bell,
    detail: "演示:研枢将于本周六 02:00-04:00 进行系统维护。",
  },
];

/** 开关(纯演示) */
function Switch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={cn(
        "relative h-5.5 w-10 shrink-0 cursor-pointer rounded-full transition-colors",
        checked ? "bg-primary" : "bg-line",
      )}
    >
      <span
        className={cn(
          "absolute left-0.5 top-[3px] size-4 rounded-full bg-white shadow-sm transition-transform",
          checked && "translate-x-5",
        )}
      />
    </button>
  );
}

function NotificationItem({
  item,
}: {
  item: (typeof NOTIFICATION_ITEMS)[number];
}) {
  const [enabled, setEnabled] = useState(true);
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="rounded-2xl bg-card px-5 py-4 shadow-card">
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-chip">
          <item.icon className="size-4.5 text-ink-2" strokeWidth={1.8} />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-10">
            <h4 className="text-sm font-semibold text-ink">{item.title}</h4>
            <Switch checked={enabled} onChange={setEnabled} />
          </div>
          {item.subtitle && (
            <p className="mt-0.5 text-xs text-muted">{item.subtitle}</p>
          )}
        </div>
        <button
          type="button"
          aria-label={expanded ? "折叠" : "展开"}
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          className="ml-auto shrink-0 cursor-pointer rounded-md p-1.5 text-faint transition-colors hover:bg-chip hover:text-ink-2"
        >
          {expanded ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
        </button>
      </div>
      {expanded && (
        <p className="mt-3 border-t border-line pt-3 text-[13px] leading-relaxed text-muted">
          {item.detail}
        </p>
      )}
    </div>
  );
}

/** 通知:四类消息条目 */
function NotificationsPanel() {
  return (
    <div className="space-y-4">
      {NOTIFICATION_ITEMS.map((item) => (
        <NotificationItem key={item.title} item={item} />
      ))}
    </div>
  );
}

/** 演示占位面板 */
function Placeholder({ text }: { text: string }) {
  return (
    <div className="rounded-2xl bg-card p-8 text-sm text-muted shadow-card">
      {text}
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
      <TabsList className="gap-4 border-b border-line">
        {SETTINGS_TABS.map((t) => (
          <TabsTrigger key={t.value} value={t.value} className="flex items-center gap-1.5">
            {t.icon ? (
              <t.icon className="size-4" strokeWidth={1.8} />
            ) : (
              <McpIcon className="size-4" />
            )}
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="profile" className="mt-6">
        <ProfilePanel />
      </TabsContent>
      <TabsContent value="usage" className="mt-6">
        <Placeholder text="用量统计(演示占位)" />
      </TabsContent>
      <TabsContent value="agent" className="mt-6">
        <Placeholder text="Agent 设置(演示占位)" />
      </TabsContent>
      <TabsContent value="mcp" className="mt-6">
        <Placeholder text="MCP 服务器配置(演示占位)" />
      </TabsContent>
      <TabsContent value="api" className="mt-6">
        <Placeholder text="API 密钥管理(演示占位)" />
      </TabsContent>
      <TabsContent value="notifications" className="mt-6">
        <NotificationsPanel />
      </TabsContent>
    </Tabs>
  );
}
