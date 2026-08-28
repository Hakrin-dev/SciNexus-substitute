"use client";

import { useState } from "react";
import { ListTree, Paperclip, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { NODE_KIND_META, NODE_STATUS_META } from "./workbench-meta";
import type { OutlineNode } from "@/lib/data/workbench";

interface Props {
  nodes: OutlineNode[];
  activeQuestionId?: string;
  onSelect: (nodeId: string) => void;
  onAddResearchEntry?: (phase: ResearchInputPhase, text: string) => void;
  className?: string;
}

export type ResearchInputPhase =
  | "plan"
  | "search"
  | "read"
  | "synthesize"
  | "experiment"
  | "report";

const INPUT_PHASES: { value: ResearchInputPhase; label: string }[] = [
  { value: "plan", label: "计划" },
  { value: "search", label: "检索" },
  { value: "read", label: "阅读" },
  { value: "synthesize", label: "综合" },
  { value: "experiment", label: "实验" },
  { value: "report", label: "报告" },
];

/** 左栏大纲轨 —— 常驻紧凑导航:研究问题 + 笔记,内嵌面板风格 */
export function OutlineRail({ nodes, activeQuestionId, onSelect, onAddResearchEntry, className }: Props) {
  const [phase, setPhase] = useState<ResearchInputPhase>("plan");
  const [draft, setDraft] = useState("");
  const questions = nodes.filter((n) => n.kind === "question");
  const notes = nodes.filter((n) => n.kind === "note");

  const submit = () => {
    const text = draft.trim();
    if (!text || !onAddResearchEntry) return;
    onAddResearchEntry(phase, text);
    setDraft("");
  };

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

      <div className="mt-4 border-t border-line pt-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-ink-2">继续研究</p>
          <select
            aria-label="内容归入研究阶段"
            value={phase}
            onChange={(event) => setPhase(event.target.value as ResearchInputPhase)}
            className="h-7 min-w-0 cursor-pointer rounded-lg border border-line bg-panel px-1.5 text-[11px] text-muted outline-none focus:border-primary"
          >
            {INPUT_PHASES.map((item) => (
              <option key={item.value} value={item.value}>
                归入：{item.label}
              </option>
            ))}
          </select>
        </div>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === "Enter") submit();
          }}
          rows={4}
          placeholder="输入想法、结果或下一步要求……"
          className="mt-2.5 w-full resize-none rounded-xl border border-line bg-panel px-3 py-2.5 text-xs leading-relaxed text-ink outline-none placeholder:text-faint focus:border-primary"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <button
            type="button"
            aria-label="关联资料"
            title="关联文献、数据或实验"
            className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted transition-colors hover:bg-panel hover:text-primary"
          >
            <Paperclip className="size-3.5" strokeWidth={1.8} />
          </button>
          <button
            type="button"
            disabled={!draft.trim() || !onAddResearchEntry}
            onClick={submit}
            className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 text-[11px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send className="size-3.5" strokeWidth={1.8} />
            提交
          </button>
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-faint">输入与 AI 整理结果会出现在右侧研究记录中。</p>
      </div>
    </aside>
  );
}

function countNodes(node: OutlineNode): number {
  return node.children.reduce((sum, child) => sum + 1 + countNodes(child), 0);
}
