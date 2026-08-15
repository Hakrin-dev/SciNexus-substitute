"use client";

import { useState } from "react";
import { SubmitBrowser } from "./submit-browser";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const KIND_TABS = [
  { value: "conference", label: "会议" },
  { value: "journal", label: "期刊" },
] as const;

const STATUS_TABS = ["Deadline", "Tracking", "Rebuttal", "History"] as const;

type KindTab = (typeof KIND_TABS)[number]["value"];
type StatusTab = (typeof STATUS_TABS)[number];

/** 投递历史(演示数据) */
const DELIVERIES = [
  {
    title: "UltraLong-1M: A Long-Context Memory Mechanism for Transformer",
    venue: "ICML 2026",
    status: "审稿中",
    variant: "violet" as const,
    date: "2026-07-20",
  },
  {
    title: "SANA-Video 2.0: Efficient Video Diffusion Transformer",
    venue: "TPAMI",
    status: "已录用",
    variant: "green" as const,
    date: "2026-06-12",
  },
  {
    title: "知识增强科研智能体的任务规划研究",
    venue: "AAAI 2026",
    status: "被拒稿",
    variant: "danger" as const,
    date: "2026-03-05",
  },
  {
    title: "面向文献调研的多智能体协作框架",
    venue: "计算机学报",
    status: "已投递",
    variant: "gray" as const,
    date: "2026-08-01",
  },
];

/** 投递历史列表(演示) */
function DeliveryHistory() {
  return (
    <div className="mt-5 space-y-2">
      {DELIVERIES.map((d) => (
        <div
          key={d.title}
          className="flex items-center gap-4 rounded-xl bg-card px-5 py-3.5 shadow-card"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold text-ink">
              {d.title}
            </p>
            <p className="mt-0.5 text-xs text-faint">
              {d.venue} · 投递于 {d.date}
            </p>
          </div>
          <Badge variant={d.variant}>{d.status}</Badge>
        </div>
      ))}
    </div>
  );
}

/** 投稿页 —— 同一行双 tab:会议/期刊 + Deadline/Tracking/Rebuttal/History */
export function SubmitHome() {
  const [kind, setKind] = useState<KindTab>("conference");
  const [status, setStatus] = useState<StatusTab>("Deadline");

  return (
    <>
      <div className="flex items-center justify-between">
        {/* 会议 / 期刊 */}
        <div className="flex w-fit rounded-full bg-sidebar p-1">
          {KIND_TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              aria-pressed={kind === t.value}
              onClick={() => setKind(t.value)}
              className={cn(
                "h-8 cursor-pointer rounded-full px-4 text-[13px] transition-colors",
                kind === t.value
                  ? "bg-primary font-medium text-white"
                  : "text-muted hover:text-ink-2",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Deadline / Tracking / Rebuttal / History */}
        <div className="flex w-fit rounded-full bg-sidebar p-1">
          {STATUS_TABS.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={status === t}
              onClick={() => setStatus(t)}
              className={cn(
                "h-8 cursor-pointer rounded-full px-4 text-[13px] transition-colors",
                status === t
                  ? "bg-primary font-medium text-white"
                  : "text-muted hover:text-ink-2",
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        {status === "History" ? (
          <DeliveryHistory />
        ) : (
          <SubmitBrowser kind={kind} />
        )}
      </div>
    </>
  );
}
