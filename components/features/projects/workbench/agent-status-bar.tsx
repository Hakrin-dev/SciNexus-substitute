"use client";

import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { StateDot } from "./workbench-meta";
import type { AgentTask } from "@/lib/data/workbench";

/** 底部 Agent 终端/日志栏 —— 后台工作流运行情况,随时感知不干扰前台 */
export function AgentStatusBar({ tasks }: { tasks: AgentTask[] }) {
  const running = tasks.filter((t) => t.state === "running").length;

  return (
    <footer className="flex items-center gap-3 overflow-x-auto rounded-2xl bg-ink/95 px-4 py-2.5 text-white shadow-card">
      <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold">
        <Bot className="size-4" />
        Agent
        {running > 0 && (
          <span className="rounded-full bg-white/15 px-1.5 py-0.5 text-[10px] font-medium">{running} 运行中</span>
        )}
      </span>
      <ul className="flex min-w-0 flex-1 items-center gap-4 overflow-x-auto">
        {tasks.map((task) => (
          <li key={task.id} className="flex shrink-0 items-center gap-1.5 text-xs text-white/75">
            <StateDot state={task.state} />
            <span
              className={cn(
                "font-mono text-[10px] uppercase tracking-wide",
                task.state === "running" ? "text-white" : "text-white/50",
              )}
            >
              {task.agent}
            </span>
            <span className="truncate">{task.label}</span>
          </li>
        ))}
      </ul>
    </footer>
  );
}
