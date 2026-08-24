"use client";

import { ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { NODE_STATUS_META } from "./workbench-meta";
import type { OutlineNode } from "@/lib/data/workbench";

interface Props {
  nodes: OutlineNode[];
  activeQuestionId?: string;
  onSelect: (nodeId: string) => void;
  className?: string;
}

/** 左栏大纲轨 —— 常驻紧凑导航:仅顶层研究问题 + 子节点计数 */
export function OutlineRail({ nodes, activeQuestionId, onSelect, className }: Props) {
  const questions = nodes.filter((n) => n.kind === "question");
  const notes = nodes.filter((n) => n.kind === "note");

  return (
    <aside className={cn("space-y-3 rounded-2xl bg-card p-4 shadow-card", className)}>
      <h2 className="flex items-center gap-1.5 px-1 text-[13px] font-semibold text-ink">
        <Sparkles className="size-3.5 text-primary" />
        研究大纲
      </h2>
      <ul className="space-y-1">
        {questions.map((q) => (
          <li key={q.id}>
            <button
              onClick={() => onSelect(q.id)}
              className={cn(
                "w-full cursor-pointer rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-chip",
                activeQuestionId === q.id && "bg-primary-soft",
              )}
            >
              <span className="flex items-center gap-1.5">
                <ChevronRight className="size-3 shrink-0 text-faint" />
                <span
                  className={cn(
                    "truncate text-[13px] font-medium",
                    activeQuestionId === q.id ? "text-primary" : "text-ink",
                  )}
                >
                  {q.title}
                </span>
              </span>
              <span className="mt-0.5 block pl-[18px] text-[11px] text-faint">
                {countNodes(q)} 个子节点 · {NODE_STATUS_META[q.status].label}
              </span>
            </button>
          </li>
        ))}
        {notes.map((n) => (
          <li key={n.id}>
            <button
              onClick={() => onSelect(n.id)}
              className="w-full cursor-pointer truncate rounded-xl px-2.5 py-2 text-left text-[13px] text-muted transition-colors hover:bg-chip"
            >
              {n.title}
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function countNodes(node: OutlineNode): number {
  return node.children.reduce((sum, child) => sum + 1 + countNodes(child), 0);
}
