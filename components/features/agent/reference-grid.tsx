"use client";

import * as React from "react";
import { ArrowRight, Bookmark, BookmarkCheck } from "lucide-react";
import { agentReferences } from "@/lib/data/agent";
import { CiteMenu } from "./cite-menu";
import { cn } from "@/lib/utils";

const TONE_COLORS: Record<string, string> = {
  violet: "bg-primary",
  green: "bg-success",
  amber: "bg-brand-blue",
  gray: "bg-muted",
};

/** 参考来源卡片组 —— 10 篇引用文献的横向卡片,每篇可存入知识库 / 导出引用 */
export function ReferenceGrid() {
  /** 已存入知识库的文献 id(演示:本地状态) */
  const [saved, setSaved] = React.useState<Record<number, boolean>>({});
  const toggleSaved = (id: number) =>
    setSaved((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <section className="rounded-2xl bg-card p-6 shadow-card">
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-semibold text-ink">
          参考来源 · 10 篇
        </h3>
        <div className="flex items-center gap-4">
          <CiteMenu refs={agentReferences} />
          <button
            type="button"
            className="flex cursor-pointer items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            查看全部
            <ArrowRight className="size-3" />
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {agentReferences.map((ref) => (
          <article
            key={ref.id}
            className={cn(
              "cursor-pointer rounded-xl border border-line p-3.5 transition-colors hover:border-primary/40",
              ref.recommended && "border-brand-blue/40 bg-brand-blue-soft",
            )}
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-xs font-semibold text-white",
                  TONE_COLORS[ref.tone],
                )}
              >
                {ref.id}
              </span>
              <span className="text-[11px] text-faint">{ref.venue}</span>
            </div>
            <p className="mt-2 line-clamp-3 text-[13px] font-medium leading-snug text-ink-2">
              {ref.title}
            </p>
            <div className="mt-2 flex items-center justify-between">
              <p className="text-[11px] text-faint">
                {ref.author} · {ref.citations}
              </p>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  aria-pressed={!!saved[ref.id]}
                  title={saved[ref.id] ? "已存入知识库" : "存入知识库"}
                  onClick={() => toggleSaved(ref.id)}
                  className={cn(
                    "cursor-pointer transition-colors",
                    saved[ref.id]
                      ? "text-primary"
                      : "text-faint hover:text-primary",
                  )}
                >
                  {saved[ref.id] ? (
                    <BookmarkCheck className="size-3.5" />
                  ) : (
                    <Bookmark className="size-3.5" />
                  )}
                </button>
                <CiteMenu refs={ref} />
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
