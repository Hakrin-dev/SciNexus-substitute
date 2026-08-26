"use client";

import * as React from "react";
import Link from "next/link";
import { FileText, History, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRecentViews, type ViewItem } from "@/stores/recent-views";
import { toast } from "@/stores/toast";

const KIND_META = {
  paper: { icon: FileText, label: "论文" },
  scholar: { icon: UserRound, label: "学者" },
} as const;

function bucketOf(at: number): "today" | "week" | "earlier" {
  const now = Date.now();
  if (now - at < 24 * 3600_000) return "today";
  if (now - at < 7 * 24 * 3600_000) return "week";
  return "earlier";
}

function formatTime(at: number): string {
  const d = new Date(at);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getMonth() + 1}月${d.getDate()}日 ${hh}:${mm}`;
}

const BUCKET_LABELS: Record<string, string> = {
  today: "今天",
  week: "近 7 天",
  earlier: "更早",
};

/** 浏览记录 `/history` —— 本地埋点时间线(论文/学者),可清空 */
export function HistoryBoard() {
  const items = useRecentViews((s) => s.items);
  const clear = useRecentViews((s) => s.clear);

  const groups = React.useMemo(() => {
    const map: Record<string, ViewItem[]> = { today: [], week: [], earlier: [] };
    for (const item of items) map[bucketOf(item.at)].push(item);
    return map;
  }, [items]);

  const handleClear = () => {
    clear();
    toast.info("浏览记录已清空");
  };

  if (items.length === 0) {
    return (
      <div className="rounded-2xl bg-card p-12 text-center shadow-card">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-chip">
          <History className="size-5 text-faint" />
        </span>
        <p className="mt-3 text-sm text-muted">暂无浏览记录</p>
        <p className="mt-1 text-xs text-faint">访问论文或学者主页后会自动记录在这里</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-faint">共 {items.length} 条 · 仅保存在本机浏览器</p>
        <Button variant="outline" size="sm" className="rounded-full" onClick={handleClear}>
          <Trash2 className="size-3.5" />
          清空记录
        </Button>
      </div>

      {(Object.keys(BUCKET_LABELS) as (keyof typeof BUCKET_LABELS)[]).map((bucket) =>
        groups[bucket].length ? (
          <section key={bucket}>
            <h2 className="mb-2 px-1 text-[11px] font-medium tracking-wide text-faint">
              {BUCKET_LABELS[bucket]}
            </h2>
            <div className="space-y-2">
              {groups[bucket].map((item) => {
                const Icon = KIND_META[item.kind].icon;
                const href =
                  item.kind === "paper"
                    ? `/papers/${item.id}`
                    : `/scholars/${item.id}`;
                return (
                  <Link
                    key={`${item.kind}-${item.id}`}
                    href={href}
                    className="flex items-center gap-3.5 rounded-xl bg-card px-4 py-3 shadow-card transition-colors hover:bg-panel"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft">
                      <Icon className="size-4 text-primary" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">
                        {item.title}
                      </span>
                      {item.subtitle && (
                        <span className="mt-0.5 block truncate text-[11px] text-faint">
                          {item.subtitle}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 rounded-full bg-chip px-2 py-0.5 text-[10px] text-muted">
                      {KIND_META[item.kind].label}
                    </span>
                    <span className="w-28 shrink-0 text-right text-[11px] tabular-nums text-faint">
                      {formatTime(item.at)}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null,
      )}
    </div>
  );
}
