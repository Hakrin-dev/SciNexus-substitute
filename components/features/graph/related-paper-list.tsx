"use client";

import type { PaperGraph } from "@/types";
import { cn } from "@/lib/utils";

interface RelatedPaperListProps {
  graph: PaperGraph;
  selectedId: string;
  onSelect: (id: string) => void;
}

/** 左栏 —— Origin paper 卡 + 关联论文列表(对应样页左栏) */
export function RelatedPaperList({
  graph,
  selectedId,
  onSelect,
}: RelatedPaperListProps) {
  const byId = new Map(
    [graph.origin, ...graph.nodes].map((n) => [n.id, n] as const),
  );
  const { origin } = graph;

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => onSelect(origin.id)}
        className={cn(
          "w-full rounded-xl border-l-2 border-primary bg-panel p-3 text-left transition-colors",
          selectedId === origin.id && "bg-primary-soft",
        )}
      >
        <p className="text-[11px] font-medium uppercase tracking-wide text-primary">
          Origin paper
        </p>
        <p className="mt-1 text-[13px] font-semibold leading-snug text-ink">
          {origin.title}
        </p>
        <p className="mt-1 text-xs text-faint">
          {origin.authors} · {origin.year}
        </p>
      </button>

      <ul className="space-y-1">
        {graph.relatedIds.map((id) => {
          const node = byId.get(id);
          if (!node) return null;
          const active = id === selectedId;
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onSelect(id)}
                className={cn(
                  "w-full rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-panel",
                  active && "bg-primary-soft hover:bg-primary-soft",
                )}
              >
                <p
                  className={cn(
                    "text-[13px] font-medium leading-snug",
                    active ? "text-primary" : "text-ink-2",
                  )}
                >
                  {node.title}
                </p>
                <p className="mt-0.5 text-[11px] text-faint">
                  {node.authors} · {node.year}
                </p>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
