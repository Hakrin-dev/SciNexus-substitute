"use client";

import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { StateDot } from "./workbench-meta";
import type { AgentTask } from "@/lib/data/workbench";

/** 底部 Agent 状态栏 —— 后台工作流运行情况,卡片化浅色样式,与全站一致 */
export function AgentStatusBar({ tasks, className }: { tasks: AgentTask[]; className?: string }) {
  const running = tasks.filter((t) => t.state === "running").length;

  return (
    <footer
      className={cn(
        "flex items-center gap-3 overflow-x-auto rounded-2xl bg-card px-4 py-3 shadow-card",
        className,
      )}
    >
      <span className="flex shrink-0 items-center gap-2 rounded-xl bg-primary-soft px-2.5 py-1.5 text-xs font-semibold text-primary">
        <Bot className="size-4" strokeWidth={1.8} />
        Agent
        {running > 0 && (
          <span className="rounded-full bg-card px-1.5 py-0.5 text-[10px] font-medium shadow-card">
            {running} 运行中
          </span>
        )}
      </span>
      <ul className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto scrollbar-subtle">
        {tasks.map((task) => (
          <li
            key={task.id}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-xl border px-3 py-1.5 text-xs transition-colors",
              task.state === "running"
                ? "border-primary/25 bg-primary-soft/60 text-ink"
                : "border-line/70 bg-panel text-muted",
            )}
          >
            <StateDot state={task.state} />
            <span className="font-mono text-[10px] uppercase tracking-wide opacity-70">
              {task.agent}
            </span>
            <span className="whitespace-nowrap">{task.label}</span>
          </li>
        ))}
      </ul>
    </footer>
  );
}
