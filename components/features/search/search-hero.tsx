"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRight,
  ArrowUpDown,
  Lightbulb,
  Search,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { searchSchema, type SearchFormValues } from "@/lib/validations";
import { cn } from "@/lib/utils";

const MODES = [
  { key: "deep", label: "深度搜索", icon: Search, active: true },
  { key: "ai", label: "AI 助手", icon: Sparkles, href: "/agents" },
  { key: "inspire", label: "灵感发现", icon: Lightbulb },
];

/** 首页顶部搜索 Hero —— 对应主发现页 SVG 的搜索卡片 */
export function SearchHero() {
  const router = useRouter();
  const { register, handleSubmit } = useForm<SearchFormValues>({
    resolver: zodResolver(searchSchema),
  });

  const onSubmit = handleSubmit(({ query }) => {
    // 深度搜索 → 深度搜索结果页(由旧 Deep Research 页迁移而来)
    router.push(`/agents/deep-search?q=${encodeURIComponent(query)}`);
  });

  return (
    <section className="rounded-2xl bg-card p-4 shadow-card">
      <form onSubmit={onSubmit} className="flex items-center gap-3 px-2">
        <Search className="size-5 shrink-0 text-faint" />
        <input
          {...register("query")}
          placeholder="帮我找一下关于扩散模型在机器人控制中的最新综述…"
          className="h-11 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-faint"
        />
        <Button type="submit" size="lg" className="rounded-xl">
          <ArrowRight className="size-4" />
          深度搜索
        </Button>
      </form>

      <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
        {MODES.map((mode) => {
          const Icon = mode.icon;
          return (
            <button
              key={mode.key}
              type="button"
              onClick={() => mode.href && router.push(mode.href)}
              className={cn(
                "flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-[13px] transition-colors",
                mode.active
                  ? "bg-primary-soft font-medium text-primary"
                  : "text-muted hover:bg-chip",
              )}
            >
              <Icon className="size-3.5" />
              {mode.label}
            </button>
          );
        })}
        <button
          type="button"
          className="ml-auto flex cursor-pointer items-center gap-1 text-xs text-faint hover:text-muted"
        >
          <ArrowUpDown className="size-3" />
          切换
        </button>
      </div>
    </section>
  );
}
