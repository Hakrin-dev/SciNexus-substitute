"use client";

import { useState } from "react";
import { Settings2, Star, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "trending", label: "趋势", icon: TrendingUp },
  { key: "latest", label: "最新" },
  { key: "ai", label: "AI 订阅", icon: Star },
  { key: "fav", label: "我的收藏" },
];

/** Feed 流标签栏 —— 趋势 / 最新 / AI 订阅 / 我的收藏 */
export function FeedTabs() {
  const [active, setActive] = useState("trending");

  return (
    <div className="flex items-center gap-5 px-1">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActive(tab.key)}
            className={cn(
              "flex cursor-pointer items-center gap-1.5 text-[15px] transition-colors",
              active === tab.key
                ? "font-semibold text-primary"
                : "text-muted hover:text-ink-2",
            )}
          >
            {Icon && <Icon className="size-4" />}
            {tab.label}
          </button>
        );
      })}
      <Button variant="outline" size="sm" className="ml-auto rounded-lg">
        <Settings2 className="size-3.5" />
        个性化
      </Button>
    </div>
  );
}
