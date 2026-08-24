"use client";

import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { CARD_KIND_META, CARD_STATUS_META } from "./workbench-meta";
import { formatDay } from "@/lib/data/workbench";
import type { ResearchThread, Selection, ThreadCard } from "@/lib/data/workbench";

interface Props {
  threads: ResearchThread[];
  cards: ThreadCard[];
  selection: Selection;
  onSelect: (cardId: string) => void;
}

/** 线程视图 —— 按研究问题分节的垂直卡片流(主工作区默认视图) */
export function ThreadView({ threads, cards, selection, onSelect }: Props) {
  return (
    <div className="space-y-5">
      {threads.map((thread) => {
        const threadCards = cards
          .filter((c) => c.threadId === thread.id)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        return (
          <section key={thread.id} className="rounded-2xl bg-card p-5 shadow-card">
            <header className="flex items-center gap-3">
              <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary">
                Q · {thread.questionId.toUpperCase()}
              </span>
              <h2 className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink">{thread.title}</h2>
              <span className="shrink-0 rounded-full bg-chip px-2.5 py-1 text-xs text-muted">
                {thread.stage}
              </span>
            </header>

            <ol className="relative mt-4 space-y-3 pl-6">
              <span className="absolute bottom-3 left-[9px] top-3 w-px bg-line" aria-hidden />
              {threadCards.map((card) => (
                <li key={card.id} className="relative">
                  <span
                    aria-hidden
                    className={cn(
                      "absolute -left-6 top-4 size-[9px] rounded-full border-2 border-card",
                      card.status === "done"
                        ? "bg-success"
                        : card.status === "doing"
                          ? "bg-brand-blue"
                          : "bg-faint",
                    )}
                  />
                  <ThreadCardRow card={card} selected={selection?.kind === "card" && selection.id === card.id} onSelect={onSelect} />
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}

function ThreadCardRow({
  card,
  selected,
  onSelect,
}: {
  card: ThreadCard;
  selected: boolean;
  onSelect: (cardId: string) => void;
}) {
  const meta = CARD_KIND_META[card.kind];
  const Icon = meta.icon;
  const isHint = card.kind === "hint";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(card.id)}
      onKeyDown={(e) => e.key === "Enter" && onSelect(card.id)}
      className={cn(
        "cursor-pointer rounded-xl border p-4 transition-colors",
        isHint ? "border-dashed border-primary/40 bg-primary-soft/50 hover:bg-primary-soft" : "border-line hover:bg-chip",
        selected && (isHint ? "border-primary bg-primary-soft" : "border-primary/50 bg-chip"),
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-md", meta.tone)}>
          <Icon className="size-3.5" />
        </span>
        <span className="text-xs font-medium text-muted">{meta.label}</span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-medium",
            CARD_STATUS_META[card.status].className,
          )}
        >
          {CARD_STATUS_META[card.status].label}
        </span>
        {card.aiGenerated && (
          <span className="ml-auto flex items-center gap-1 text-[11px] text-faint">
            <Sparkles className="size-3 text-primary" />
            AI 生成
          </span>
        )}
      </div>
      <p className="mt-2 text-sm font-semibold text-ink">{card.title}</p>
      <p className="mt-1 text-[13px] leading-relaxed text-muted">{card.summary}</p>
      <p className="mt-2 text-[11px] text-faint">
        {formatDay(card.createdAt)}
        {card.assetRefs.length > 0 && ` · ${card.assetRefs.length} 个关联资产`}
      </p>
    </div>
  );
}
