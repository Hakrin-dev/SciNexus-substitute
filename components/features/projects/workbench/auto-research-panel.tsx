"use client";

import { useMemo, useState } from "react";
import { Check, Circle, Pause, Play, RotateCcw, Send, Square, WandSparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useAddResearchInstruction,
  useResearchExperiments,
  useResearchRunAction,
  useResearchRunEvents,
  useResearchRuns,
  useStartResearchRun,
} from "@/lib/api/services";
import type { ResearchEngineStage, ResearchRun } from "@/lib/data/workbench";

const STAGES: { key: ResearchEngineStage; label: string }[] = [
  { key: "plan", label: "计划" },
  { key: "search", label: "检索" },
  { key: "read", label: "阅读" },
  { key: "synthesize", label: "综合" },
  { key: "design", label: "设计" },
  { key: "code", label: "代码" },
  { key: "run", label: "运行" },
  { key: "report", label: "报告" },
];

const STATUS_LABEL: Record<ResearchRun["status"], string> = {
  queued: "排队中",
  running: "运行中",
  paused: "已暂停",
  completed: "已完成",
  failed: "失败",
  cancelled: "已取消",
};
const MODE_LABEL = { full: "完整在线模式", degraded: "部分降级模式", offline: "离线演示模式" } as const;

type ResearchProfile = "fast" | "standard" | "deep";
const PROFILE_META: Record<ResearchProfile, { label: string; hint: string; config: Record<string, unknown> }> = {
  fast: { label: "快速", hint: "4 篇候选，适合方向验证", config: { research_profile: "fast", max_papers: 4, llm_max_workers: 4, experiment_timeout_sec: 60 } },
  standard: { label: "标准", hint: "12 篇候选，质量与速度平衡", config: { research_profile: "standard", max_papers: 12, llm_max_workers: 3, experiment_timeout_sec: 120 } },
  deep: { label: "深度", hint: "24 篇候选，更完整但耗时更长", config: { research_profile: "deep", max_papers: 24, llm_max_workers: 4, experiment_timeout_sec: 300, strict_search: true } },
};

export function AutoResearchPanel({ projectId, defaultObjective, readOnly = false, selectedRunId, onSelectedRunIdChange }: { projectId: string; defaultObjective: string; readOnly?: boolean; selectedRunId?: string; onSelectedRunIdChange: (runId: string | undefined) => void }) {
  const [enabled, setEnabled] = useState(false);
  const [objective, setObjective] = useState(defaultObjective);
  const [instruction, setInstruction] = useState("");
  const [profile, setProfile] = useState<ResearchProfile>("standard");
  const { data: runs = [] } = useResearchRuns(projectId);
  const activeRun = useMemo(
    () => runs.find((run) => run.id === selectedRunId) ?? runs[0],
    [runs, selectedRunId],
  );
  const { data: events = [] } = useResearchRunEvents(projectId, activeRun?.id);
  const { data: experiments = [] } = useResearchExperiments(projectId, activeRun?.id);
  const start = useStartResearchRun(projectId);
  const action = useResearchRunAction(projectId, activeRun?.id);
  const addInstruction = useAddResearchInstruction(projectId, activeRun?.id);

  if (!enabled && !(readOnly && activeRun)) {
    return (
      <section className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary-soft/70 to-card p-4 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-white"><WandSparkles className="size-4.5" /></span>
            <div>
              <div className="flex items-center gap-2"><h2 className="text-sm font-bold text-ink">自动研究模式</h2>{readOnly && <span className="rounded-full bg-card px-2 py-0.5 text-[10px] text-muted">示例只读</span>}</div>
              <p className="mt-0.5 text-xs text-muted">自动完成计划、检索、阅读、综合、实验和报告，并保留完整证据链。</p>
            </div>
          </div>
          <button onClick={() => setEnabled(true)} className="h-9 rounded-lg bg-primary px-4 text-xs font-medium text-white">进入自动研究</button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-primary/20 bg-card p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><WandSparkles className="size-4 text-primary" /><h2 className="text-[15px] font-bold text-ink">自动研究控制台</h2></div>
          <p className="mt-1 text-xs text-muted">任务在独立 worker 中运行；暂停和追加指令在安全检查点生效。</p>
        </div>
        <button onClick={() => setEnabled(false)} className="text-xs text-muted hover:text-ink">收起控制台</button>
      </div>

      {readOnly && <p className="mt-4 rounded-xl border border-primary/15 bg-primary-soft/40 px-3.5 py-2.5 text-xs text-muted">这是公共示例的完整自动研究控制台。运行历史、阶段、实验和事件均可查看；创建或控制任务请进入你自己的项目。</p>}

      {runs.length > 0 && <div className="mt-4 flex items-center gap-2"><span className="text-[11px] text-muted">研究历史</span><select value={selectedRunId || ""} onChange={(event) => onSelectedRunIdChange(event.target.value || undefined)} className="h-8 min-w-0 flex-1 rounded-lg border border-line bg-panel px-2.5 text-xs text-ink outline-none"><option value="">最近一次运行</option>{runs.map((run, index) => <option key={run.id} value={run.id}>{index + 1}. {run.objective}（{STATUS_LABEL[run.status]}）</option>)}</select></div>}

      {!readOnly && (!activeRun || ["completed", "failed", "cancelled"].includes(activeRun.status)) ? (
        <div className="mt-4 space-y-2">
          <div className="flex flex-wrap items-center gap-2">{(Object.keys(PROFILE_META) as ResearchProfile[]).map((key) => <button key={key} onClick={() => setProfile(key)} className={cn("rounded-lg px-3 py-1.5 text-xs", profile === key ? "bg-primary text-white" : "bg-panel text-muted")}>{PROFILE_META[key].label}</button>)}<span className="text-[11px] text-faint">{PROFILE_META[profile].hint}</span></div>
          <div className="flex gap-2">
          <textarea value={objective} onChange={(event) => setObjective(event.target.value)} rows={2} placeholder="输入本轮自动研究目标" className="min-h-16 flex-1 resize-none rounded-xl border border-line bg-panel px-3 py-2.5 text-sm text-ink outline-none focus:border-primary" />
          <button disabled={!objective.trim() || start.isPending} onClick={() => {
            start.mutate(
              { objective: objective.trim(), config: PROFILE_META[profile].config },
              { onSuccess: (result) => onSelectedRunIdChange(result.run.id) },
            );
          }} className="self-stretch rounded-xl bg-primary px-4 text-xs font-medium text-white disabled:opacity-50">
            <Play className="mx-auto mb-1 size-4" />{start.isPending ? "创建中" : "开始研究"}
          </button>
          </div>
        </div>
      ) : null}

      {activeRun && (
        <div className="mt-4 space-y-4">
          <div className="rounded-xl bg-panel p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0"><p className="truncate text-sm font-medium text-ink">{activeRun.objective}</p><p className="mt-1 text-[11px] text-muted">{STATUS_LABEL[activeRun.status]} · 第 {activeRun.attempt} 轮 · {activeRun.progress}% · 排队 {duration(activeRun.createdAt, activeRun.startedAt)} · 执行 {duration(activeRun.startedAt, activeRun.finishedAt ?? (activeRun.startedAt ? new Date().toISOString() : null))}</p>{activeRun.decision?.executionMode && <span className="mt-1.5 inline-flex rounded-full bg-chip px-2 py-0.5 text-[10px] text-muted">{MODE_LABEL[activeRun.decision.executionMode]}</span>}</div>
              <div className="flex gap-1.5">
                {["queued", "running"].includes(activeRun.status) && <ControlButton label={activeRun.controlRequested === "pause" ? "等待暂停" : "暂停"} icon={Pause} disabled={Boolean(activeRun.controlRequested) || action.isPending} onClick={() => action.mutate("pause")} />}
                {activeRun.status === "paused" && <ControlButton label="恢复" icon={RotateCcw} disabled={action.isPending} onClick={() => action.mutate("resume")} />}
                {["queued", "running", "paused"].includes(activeRun.status) && <ControlButton label="取消" icon={Square} disabled={Boolean(activeRun.controlRequested) || action.isPending} onClick={() => action.mutate("cancel")} />}
              </div>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-chip"><div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${activeRun.progress}%` }} /></div>
            {activeRun.status === "queued" && <p className="mt-2 text-[11px] text-amber-600">正在等待研究执行器领取任务。本地开发会自动启动执行器，生产环境由独立 worker 消费队列。</p>}
            <StageTrack run={activeRun} />
            {activeRun.errorMessage && <p className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{activeRun.errorMessage.split("\n")[0]}</p>}
            {activeRun.decision?.reason && <p className="mt-3 rounded-lg bg-success/10 px-3 py-2 text-xs text-success">闭环决策：{activeRun.decision.reason}</p>}
          </div>

          {["queued", "running", "paused"].includes(activeRun.status) && (
            <div className="flex gap-2">
              <input value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder="追加约束、研究方向或审阅意见" className="h-9 flex-1 rounded-lg border border-line bg-panel px-3 text-xs outline-none focus:border-primary" />
              <button disabled={!instruction.trim() || addInstruction.isPending} onClick={() => addInstruction.mutate(instruction.trim(), { onSuccess: () => setInstruction("") })} className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs text-white disabled:opacity-50"><Send className="size-3.5" />追加指令</button>
            </div>
          )}

          {experiments.length > 0 && <div className="grid gap-2 sm:grid-cols-2">{experiments.map((experiment) => <div key={experiment.id} className="rounded-xl border border-line p-3"><p className="text-xs font-bold text-ink">{experiment.title}</p><p className="mt-1 text-[11px] text-muted">{experiment.status} · {Object.entries(experiment.metrics).slice(0, 3).map(([key, value]) => `${key}: ${String(value)}`).join(" · ") || "暂无指标"}</p></div>)}</div>}

          {events.length > 0 && <details className="rounded-xl border border-line p-3" open={activeRun.status === "failed"}><summary className="cursor-pointer text-xs font-medium text-ink">运行记录（{events.length}）</summary><ol className="mt-2 max-h-52 space-y-1.5 overflow-y-auto">{events.slice(-30).reverse().map((event) => <li key={event.id} className={cn("text-[11px] leading-relaxed", event.level === "error" ? "text-danger" : "text-muted")}><span className="mr-2 text-faint">#{event.sequence}</span>{event.message}</li>)}</ol></details>}
        </div>
      )}
    </section>
  );
}

function duration(start: string | null, end: string | null): string {
  if (!start || !end) return "—";
  const seconds = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000));
  return seconds < 60 ? `${seconds}秒` : `${Math.floor(seconds / 60)}分${seconds % 60}秒`;
}

function StageTrack({ run }: { run: ResearchRun }) {
  const current = STAGES.findIndex((stage) => stage.key === run.engineStage);
  return <div className="mt-3 flex min-w-max items-center gap-1 overflow-x-auto pb-1">{STAGES.map((stage, index) => { const done = run.status === "completed" || index < current; const active = index === current && !["completed", "cancelled"].includes(run.status); return <div key={stage.key} className={cn("flex items-center gap-1 rounded-md px-2 py-1 text-[11px]", active ? "bg-primary-soft text-primary" : done ? "text-success" : "text-faint")}>{done ? <Check className="size-3" /> : <Circle className="size-2.5" />}{stage.label}</div>; })}</div>;
}

function ControlButton({ label, icon: Icon, disabled, onClick }: { label: string; icon: typeof Pause; disabled?: boolean; onClick: () => void }) {
  return <button disabled={disabled} onClick={onClick} className="flex h-8 items-center gap-1 rounded-lg border border-line bg-card px-2.5 text-[11px] text-muted disabled:opacity-50"><Icon className="size-3" />{label}</button>;
}
