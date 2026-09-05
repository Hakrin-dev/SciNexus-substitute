"use client";

import * as React from "react";
import { ArrowRight, Bookmark, BookmarkCheck, ExternalLink } from "lucide-react";
import { agentReferences } from "@/lib/data/agent";
import { client, ApiError } from "@/lib/api/client";
import { toast } from "@/stores/toast";
import { CiteMenu } from "./cite-menu";
import { cn } from "@/lib/utils";
import type { AgentReference } from "@/types";

const TONE_COLORS: Record<string, string> = {
  violet: "bg-primary",
  green: "bg-success",
  amber: "bg-brand-blue",
  gray: "bg-muted",
};

/** 仅放行 http(s) 外链，防 javascript: 等危险 scheme */
const SAFE_URL_PATTERN = /^https?:\/\//i;

/** 参考来源卡片组 —— 引用文献的横向卡片,每篇可存入知识库 / 导出引用。
 *  `refs` 可选；传入则使用传入列表，否则回退演示数据。
 */
export function ReferenceGrid({
  refs,
}: {
  refs?: AgentReference[];
} = {}) {
  const items = refs ?? agentReferences;
  /** 已存入知识库的文献(以标题去重) */
  const [saved, setSaved] = React.useState<Record<number, boolean>>({});
  const [saving, setSaving] = React.useState<Record<number, boolean>>({});

  /** 存入知识库:调真实 /api/library(需登录);未登录给出明确引导 */
  const saveToLibrary = async (ref: AgentReference) => {
    if (saved[ref.id]) return;
    setSaving((p) => ({ ...p, [ref.id]: true }));
    try {
      await client.library.add({
        title: ref.title,
        venue: ref.venue,
        authors: ref.author,
      });
      setSaved((prev) => ({ ...prev, [ref.id]: true }));
      toast.success("已存入知识库");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        toast.error("请先登录后再存入知识库");
      } else {
        toast.error("存入失败，请稍后重试");
      }
    } finally {
      setSaving((p) => ({ ...p, [ref.id]: false }));
    }
  };

  return (
    <section className="rounded-2xl bg-card p-6 shadow-card">
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-semibold text-ink">
          参考来源 · {items.length} 篇
        </h3>
        <div className="flex items-center gap-4">
          <CiteMenu refs={items} />
          <button
            type="button"
            disabled
            title="查看全部：即将上线"
            className="flex cursor-not-allowed items-center gap-1 text-xs font-medium text-faint"
          >
            查看全部
            <ArrowRight className="size-3" />
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((ref) => (
          <article
            key={ref.id}
            className={cn(
              "rounded-xl border border-line p-3.5 transition-colors hover:border-primary/40",
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
            {ref.url && SAFE_URL_PATTERN.test(ref.url) ? (
              <a
                href={ref.url}
                target="_blank"
                rel="noopener noreferrer"
                title="打开网页来源"
                className="mt-2 flex items-start gap-1 text-[13px] font-medium leading-snug text-ink-2 transition-colors hover:text-primary"
              >
                <span className="line-clamp-3">{ref.title}</span>
                <ExternalLink className="mt-0.5 size-3 shrink-0 text-faint" />
              </a>
            ) : (
              <p className="mt-2 line-clamp-3 text-[13px] font-medium leading-snug text-ink-2">
                {ref.title}
              </p>
            )}
            <div className="mt-2 flex items-center justify-between">
              <p className="text-[11px] text-faint">
                {ref.author} · {ref.citations}
              </p>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  aria-pressed={!!saved[ref.id]}
                  disabled={!!saving[ref.id]}
                  title={saved[ref.id] ? "已存入知识库" : "存入知识库"}
                  onClick={() => void saveToLibrary(ref)}
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
