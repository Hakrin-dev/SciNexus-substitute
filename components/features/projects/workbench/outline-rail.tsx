"use client";

import { ListTree } from "lucide-react";
import { cn } from "@/lib/utils";
import { NODE_KIND_META, NODE_STATUS_META } from "./workbench-meta";
import type { OutlineNode } from "@/lib/data/workbench";

interface Props {
  nodes: OutlineNode[];
  activeQuestionId?: string;
  onSelect: (nodeId: string) => void;
  className?: string;
}

/** 左栏大纲轨 —— 常驻紧凑导航:研究问题 + 笔记,内嵌面板风格 */
export function OutlineRail({ nodes, activeQuestionId, onSelect, className }: Props) {
  const questions = nodes.filter((n) => n.kind === "question");
  const notes = nodes.filter((n) => n.kind === "note");

  return (
    <aside className={cn("rounded-2xl bg-card p-4 shadow-card", className)}>
      <p className="flex items-center gap-2 px-1 text-xs font-semibold text-ink-2">
        <ListTree className="size-4 text-primary" strokeWidth={1.8} />
        研究大纲
      </p>

      <div className="mt-3 rounded-xl bg-panel p-1.5">
        <ul className="space-y-0.5">
          {questions.map((q) => {
            const meta = NODE_KIND_META[q.kind];
            const Icon = meta.icon;
            const active = activeQuestionId === q.id;
            return (
              <li key={q.id}>
                <button
                  onClick={() => onSelect(q.id)}
                  className={cn(
                    "w-full cursor-pointer rounded-lg px-2.5 py-2 text-left transition-colors",
                    active ? "bg-primary-soft" : "hover:bg-card",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        "flex size-5.5 shrink-0 items-center justify-center rounded-md",
                        active ? "bg-card text-primary shadow-card" : meta.tone,
                      )}
                    >
                      <Icon className="size-3" strokeWidth={1.8} />
                    </span>
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate text-xs font-medium",
                        active ? "text-primary" : "text-ink",
                      )}
                    >
                      {q.title}
                    </span>
                  </span>
                  <span className="mt-1 block pl-[30px] text-[10px] text-faint">
                    {countNodes(q)} 个子节点 · {NODE_STATUS_META[q.status].label}
                  </span>
                </button>
              </li>
            );
          })}
          {notes.map((n) => {
            const meta = NODE_KIND_META[n.kind];
            const Icon = meta.icon;
            return (
              <li key={n.id}>
                <button
                  onClick={() => onSelect(n.id)}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-card"
                >
                  <span className={cn("flex size-5.5 shrink-0 items-center justify-center rounded-md", meta.tone)}>
                    <Icon className="size-3" strokeWidth={1.8} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs text-muted">{n.title}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <p className="mt-3 px-1 text-[11px] leading-relaxed text-faint">
        大纲即论文目录,AI 自动维护「问题-假设-证据」链路。
      </p>
    </aside>
  );
}

function countNodes(node: OutlineNode): number {
  return node.children.reduce((sum, child) => sum + 1 + countNodes(child), 0);
}
