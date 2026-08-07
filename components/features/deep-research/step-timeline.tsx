import { BookOpen, Brain, PenLine, Search } from "lucide-react";
import type { DRStepEvent, DRStepKind } from "@/types";
import { cn } from "@/lib/utils";

const KIND_ICON: Record<DRStepKind, typeof Search> = {
  search: Search,
  read: BookOpen,
  analyze: Brain,
  write: PenLine,
};

/** 研究过程步骤时间线 —— 随播放逐条出现,最新一条高亮 */
export function StepTimeline({ events }: { events: DRStepEvent[] }) {
  return (
    <section className="rounded-2xl bg-card p-4 shadow-card">
      <h2 className="text-sm font-semibold text-ink">研究过程</h2>
      {events.length === 0 ? (
        <p className="mt-3 text-xs text-faint">正在制定研究计划…</p>
      ) : (
        <ol className="mt-3 space-y-3">
          {events.map((e, i) => {
            const Icon = KIND_ICON[e.kind];
            const latest = i === events.length - 1;
            return (
              <li key={`${e.kind}-${e.offsetMs}`} className="flex items-start gap-2.5">
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full",
                    latest
                      ? "bg-primary-soft text-primary"
                      : "bg-chip text-faint",
                  )}
                >
                  <Icon className="size-3" aria-hidden="true" />
                </span>
                <p
                  className={cn(
                    "pt-1 text-xs leading-snug",
                    latest ? "text-ink" : "text-muted",
                  )}
                >
                  {e.label}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
