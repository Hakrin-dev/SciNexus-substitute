"use client";

import { Workflow } from "lucide-react";
import { cn } from "@/lib/utils";
import { CARD_KIND_META, CARD_STATUS_META } from "./workbench-meta";
import { formatDay } from "@/lib/data/workbench";
import type { ResearchThread, Selection, ThreadCard } from "@/lib/data/workbench";

interface Props {
  threads: ResearchThread[];
  cards: ThreadCard[];
  selection: Selection;
  onSelect: (cardId: string) => void;
  /** 卡片状态流转(todo→doing→done);传入后状态徽章可点击 */
  onStatusChange?: (cardId: string, status: ThreadCard["status"]) => void;
}

/** 线程视图 —— 按研究问题分节的垂直卡片流(主工作区默认视图) */
export function ThreadView({ threads, cards, selection, onSelect, onStatusChange }: Props) {
  return (
    <div className="space-y-5">
      {threads.map((thread) => {
        const threadCards = cards
          .filter((c) => c.threadId === thread.id)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        return (
          <section key={thread.id} className="rounded-2xl bg-card p-6 shadow-card">
            <header className="flex items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <Workflow className="size-5" strokeWidth={1.8} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-[15px] font-bold text-ink">{thread.title}</h2>
                <p className="mt-0.5 text-xs text-muted">
                  {thread.questionId.toUpperCase()} · 当前阶段
                  <span className="ml-1.5 rounded-full bg-chip px-2 py-0.5 text-[11px] font-medium text-muted">
                    {thread.stage}
                  </span>
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-panel px-2.5 py-1 text-[11px] text-faint">
                {threadCards.length} 张卡片
              </span>
            </header>

            <ol className="relative mt-6 space-y-3 pl-7">
              <span className="absolute bottom-4 left-[11px] top-4 w-px bg-line" aria-hidden />
              {threadCards.map((card, index) => (
                <li
                  key={card.id}
                  className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both relative duration-300"
                  style={{ animationDelay: `${Math.min(index * 50, 250)}ms` }}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "absolute -left-7 top-5 size-[9px] rounded-full border-2 border-card",
                      card.kind === "hint"
                        ? "bg-primary"
                        : card.status === "done"
                          ? "bg-success"
                          : card.status === "doing"
                            ? "bg-brand-blue"
                            : "bg-faint",
                    )}
                  />
                  <ThreadCardRow
                    card={card}
                    selected={selection?.kind === "card" && selection.id === card.id}
                    onSelect={onSelect}
                    onStatusChange={onStatusChange}
                  />
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
  onStatusChange,
}: {
  card: ThreadCard;
  selected: boolean;
  onSelect: (cardId: string) => void;
  onStatusChange?: (cardId: string, status: ThreadCard["status"]) => void;
}) {
  const meta = CARD_KIND_META[card.kind];
  const Icon = meta.icon;
  const isHint = card.kind === "hint";

  const cycleStatus = () => {
    if (!onStatusChange) return;
    const next: ThreadCard["status"] =
      card.status === "todo" ? "doing" : card.status === "doing" ? "done" : "todo";
    onStatusChange(card.id, next);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(card.id)}
      onKeyDown={(e) => e.key === "Enter" && onSelect(card.id)}
      className={cn(
        "cursor-pointer rounded-xl border p-4 transition-all",
        isHint
          ? "border-dashed border-primary/40 bg-primary-soft/50 hover:-translate-y-0.5 hover:bg-primary-soft hover:shadow-pop"
          : "border-line/70 bg-card hover:-translate-y-0.5 hover:bg-panel hover:shadow-pop",
        selected && (isHint ? "!border-primary bg-primary-soft shadow-pop" : "border-primary/60 bg-panel shadow-pop"),
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-md", meta.tone)}>
          <Icon className="size-3.5" strokeWidth={1.8} />
        </span>
        <span className="text-xs font-medium text-muted">{meta.label}</span>
        <button
          type="button"
          aria-label={`切换状态(当前:${CARD_STATUS_META[card.status].label})`}
          title={onStatusChange ? "点击切换状态:待办 → 进行中 → 已完成" : undefined}
          disabled={!onStatusChange}
          onClick={(e) => {
            e.stopPropagation();
            cycleStatus();
          }}
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-medium",
            CARD_STATUS_META[card.status].className,
            onStatusChange
              ? "cursor-pointer hover:ring-1 hover:ring-primary/40"
              : "cursor-default",
          )}
        >
          {CARD_STATUS_META[card.status].label}
        </button>
        {card.aiGenerated && (
          <span className="ml-auto flex items-center gap-1 text-[11px] text-faint">
            <span className="inline-flex size-4 items-center justify-center rounded-full bg-primary-soft">
              ✦
            </span>
            AI 生成
          </span>
        )}
      </div>
      <p className="mt-2.5 text-sm font-bold leading-snug text-ink">{card.title}</p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{card.summary}</p>
      <p className="mt-2.5 text-[11px] text-faint">
        {formatDay(card.createdAt)}
        {card.assetRefs.length > 0 && ` · ${card.assetRefs.length} 个关联资产`}
      </p>
    </div>
  );
}
