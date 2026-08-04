"use client";

import { useState } from "react";
import { Flame, Search, Settings2, Star, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "recommend", label: "推荐", icon: Flame },
  { key: "frontier", label: "前沿", icon: TrendingUp },
  { key: "follow", label: "关注", icon: Star },
  { key: "research", label: "研究", icon: Search },
];

/** Feed 流标签栏 —— 推荐 / 前沿 / 关注 / 研究 */
export function FeedTabs() {
  const [active, setActive] = useState("recommend");

  return (
    <div className="flex items-center gap-8 px-1">
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
