"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { ACTOR_META, LOG_TYPE_LABELS } from "./workbench-meta";
import { formatDay } from "@/lib/data/workbench";
import type { ActivityEntry } from "@/lib/data/workbench";

interface Props {
  entries: ActivityEntry[];
}

const TYPE_FILTERS = ["all", "note", "literature", "data", "task", "summary"] as const;

/** 日志视图 —— 时间倒序活动流 + 类型筛选 */
export function LogView({ entries }: Props) {
  const [type, setType] = useState<(typeof TYPE_FILTERS)[number]>("all");

  const filtered = useMemo(
    () =>
      [...entries]
        .sort((a, b) => b.at.localeCompare(a.at))
        .filter((entry) => type === "all" || entry.type === type),
    [entries, type],
  );

  return (
    <section className="rounded-2xl bg-card p-5 shadow-card">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">研究日志</h2>
          <p className="mt-0.5 text-xs text-faint">实验记录本 · 共 {entries.length} 条</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {TYPE_FILTERS.map((item) => (
            <button
              key={item}
              onClick={() => setType(item)}
              className={cn(
                "cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                type === item ? "bg-primary text-primary-foreground" : "bg-chip text-muted hover:bg-primary-soft",
              )}
            >
              {item === "all" ? "全部" : LOG_TYPE_LABELS[item]}
            </button>
          ))}
        </div>
      </header>

      <ol className="relative mt-4 space-y-3 pl-7">
        <span className="absolute bottom-3 left-[11px] top-3 w-px bg-line" aria-hidden />
        {filtered.map((entry) => {
          const actor = ACTOR_META[entry.actor];
          const Icon = actor.icon;
          return (
            <li key={entry.id} className="relative rounded-xl px-4 py-3 transition-colors hover:bg-chip">
              <span
                aria-hidden
                className={cn(
                  "absolute -left-7 top-3.5 flex size-6 items-center justify-center rounded-full border-2 border-card",
                  actor.tone,
                )}
              >
                <Icon className="size-3" />
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-ink">{actor.label}</span>
                <span className="rounded-full bg-chip px-2 py-0.5 text-[11px] text-muted">
                  {LOG_TYPE_LABELS[entry.type]}
                </span>
                {entry.threadId && (
                  <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] text-primary">
                    {entry.threadId.toUpperCase()}
                  </span>
                )}
                <span className="ml-auto text-[11px] text-faint">{formatDay(entry.at)}</span>
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{entry.text}</p>
            </li>
          );
        })}
      </ol>

      {filtered.length === 0 && (
        <div className="mt-3 rounded-xl p-10 text-center text-sm text-faint">暂无该类型的日志</div>
      )}
    </section>
  );
}
