"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgentReference } from "@/types";

/** 深度轮工作流步骤(AI 搜索报告块与对话容器共用) */
export interface WorkflowStep {
  agent: string;
  action: string;
  status: string;
  tools?: string[];
}
export interface Workflow {
  task_id?: string;
  agents?: string[];
  steps: WorkflowStep[];
  status?: string;
}

/** 参考来源的会话传输形状(meta.references) */
export interface ChatReference {
  title: string;
  authors: string;
  venue: string;
  year?: number | null;
  ccf?: string | null;
  citations?: number;
  match?: string;
  /** 联网检索来源链接（仅 WebSearch 结果非空） */
  url?: string | null;
}

export const DEFAULT_STEPS: WorkflowStep[] = [
  { agent: "scout", action: "", status: "running" },
  { agent: "synthesis", action: "", status: "pending" },
];

export function toRefsFromPapers(
  papers: {
    id: string;
    title: string;
    authors: string;
    venue: string;
    ccf: string;
    year: number | null;
    citations: number;
    url?: string | null;
  }[],
): AgentReference[] {
  return papers.slice(0, 8).map((p, index) => ({
    id: index + 1,
    venue: p.year ? `${p.venue || "arXiv"} · ${p.year}` : p.venue || "arXiv",
    title: p.title,
    author: p.authors || "未知作者",
    citations: `引用 ${p.citations}`,
    tone:
      p.ccf === "A" ? "violet" : p.ccf === "B" ? "amber" : p.ccf === "C" ? "gray" : "green",
    url: p.url,
  }));
}

export function toRefsFromChat(refs: ChatReference[]): AgentReference[] {
  return refs.slice(0, 8).map((r, index) => ({
    id: index + 1,
    venue: r.year ? `${r.venue || "arXiv"} · ${r.year}` : r.venue || "arXiv",
    title: r.title,
    author: r.authors || "未知作者",
    citations: `引用 ${r.citations ?? 0}`,
    url: r.url,
    tone:
      r.ccf === "A" ? "violet" : r.ccf === "B" ? "amber" : r.ccf === "C" ? "gray" : "green",
  }));
}

/**
 * 智能体工作流追踪条。
 * 后端在回答完成后一次性下发 steps(不做假实时进度);active 时显示真实耗时秒表。
 */
export function WorkflowTrace({
  workflow,
  active = false,
}: {
  workflow: Workflow | null;
  active?: boolean;
}) {
  const steps: WorkflowStep[] =
    workflow && workflow.steps.length > 0
      ? workflow.steps
      : DEFAULT_STEPS.map((s) => ({ ...s, status: active ? s.status : "pending" }));
  const currentRunning = steps.some((s) => s.status === "running");

  // 真实耗时秒表(active 时计时;工作流步骤由后端一次性下发,不做假实时进度)
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!active) return;
    const start = Date.now();
    const timer = setInterval(
      () => setElapsed(Math.floor((Date.now() - start) / 1000)),
      1000,
    );
    return () => clearInterval(timer);
  }, [active]);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl bg-panel px-3.5 py-2.5 text-xs">
      <span className="text-faint">智能体工作流</span>
      {steps.map((step, index) => (
        <span key={`${step.agent}-${index}`} className="flex items-center gap-1.5">
          {step.status === "done" ? (
            <CheckCircle2 className="size-3.5 text-success" />
          ) : step.status === "failed" || step.status === "blocked" ? (
            <XCircle className="size-3.5 text-danger" />
          ) : step.status === "running" || (active && index === 0 && !currentRunning) ? (
            <Loader2 className="size-3.5 animate-spin text-primary" />
          ) : (
            <span className="size-3.5 rounded-full border border-line" />
          )}
          <span
            className={cn(
              "font-medium",
              step.status === "done"
                ? "text-ink"
                : step.status === "running"
                  ? "text-primary"
                  : "text-muted",
            )}
          >
            {step.agent}
          </span>
        </span>
      ))}
      {active && <span className="text-faint">已运行 {elapsed}s · 通常需要 10~30s</span>}
    </div>
  );
}
