"use client";

import { useState } from "react";
import {
  BarChart3,
  BrainCircuit,
  Check,
  ChevronRight,
  Circle,
  Code2,
  FileCode2,
  FlaskConical,
  GitCompare,
  MoveUpRight,
  Play,
  RotateCcw,
  Workflow,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CARD_KIND_META, CARD_STATUS_META } from "./workbench-meta";
import { formatDay } from "@/lib/data/workbench";
import type {
  ResearchStageKey,
  ResearchThread,
  Selection,
  ThreadCard,
} from "@/lib/data/workbench";

type ResearchPhaseKey = "plan" | "search" | "read" | "synthesize" | "experiment" | "report";

const RESEARCH_PHASES: { key: ResearchPhaseKey; label: string; stages: ResearchStageKey[] }[] = [
  { key: "plan", label: "计划", stages: ["plan"] },
  { key: "search", label: "检索", stages: ["search"] },
  { key: "read", label: "阅读", stages: ["read"] },
  { key: "synthesize", label: "综合", stages: ["synthesize"] },
  { key: "experiment", label: "实验", stages: ["design", "code", "run"] },
  { key: "report", label: "报告", stages: ["report"] },
];

interface Props {
  threads: ResearchThread[];
  cards: ThreadCard[];
  localCards?: ThreadCard[];
  selection: Selection;
  onSelect: (cardId: string) => void;
  onSelectAsset?: (assetId: string) => void;
  onPhaseSelect?: (phaseId: ResearchPhaseKey | null) => void;
  /** 卡片状态流转(todo→doing→done);传入后状态徽章可点击 */
  onStatusChange?: (cardId: string, status: ThreadCard["status"]) => void;
}

/** 线程视图 —— 按研究问题分节的垂直卡片流(主工作区默认视图) */
export function ThreadView({
  threads,
  cards,
  localCards = [],
  selection,
  onSelect,
  onSelectAsset,
  onPhaseSelect,
  onStatusChange,
}: Props) {
  const [activePhase, setActivePhase] = useState<ResearchPhaseKey | "all">("all");
  const displayCards = [...cards, ...localCards];
  const completedStages = new Set(
    displayCards.filter((card) => card.status === "done").map((card) => card.stage),
  );
  const currentStage = displayCards.find((card) => card.status === "doing")?.stage ?? "design";

  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-card p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-bold text-ink">研究过程</h2>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto pb-1">
          <div className="flex min-w-max items-center gap-1" role="list" aria-label="研究阶段">
            <div className="flex items-center" role="listitem">
              <button
                type="button"
                aria-pressed={activePhase === "all"}
                onClick={() => {
                  setActivePhase("all");
                  onPhaseSelect?.(null);
                }}
                className={cn(
                  "flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors",
                  activePhase === "all"
                    ? "bg-primary text-white"
                    : "text-muted hover:bg-panel hover:text-ink",
                )}
              >
                <Workflow className="size-3.5" strokeWidth={1.8} />
                总览
              </button>
              <ChevronRight className="mx-0.5 size-3.5 text-faint" aria-hidden />
            </div>
            {RESEARCH_PHASES.map((phase, index) => {
              const completed = phase.stages.every((stage) => completedStages.has(stage));
              const current = phase.stages.includes(currentStage);
              const selected = activePhase === phase.key;
              return (
                <div key={phase.key} className="flex items-center" role="listitem">
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      const next = selected ? "all" : phase.key;
                      setActivePhase(next);
                      onPhaseSelect?.(next === "all" ? null : next);
                    }}
                    className={cn(
                      "flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-xs transition-colors",
                      selected
                        ? "bg-primary text-white"
                        : current
                          ? "bg-primary-soft text-primary"
                          : "text-muted hover:bg-panel hover:text-ink",
                    )}
                  >
                    {completed ? (
                      <Check className="size-3.5" strokeWidth={2} />
                    ) : (
                      <Circle className="size-3" strokeWidth={current ? 2.4 : 1.6} />
                    )}
                    {phase.label}
                  </button>
                  {index < RESEARCH_PHASES.length - 1 && (
                    <ChevronRight className="mx-0.5 size-3.5 text-faint" aria-hidden />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 rounded-xl border-l-4 border-primary bg-primary-soft/50 px-4 py-3.5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium text-primary">本轮研究汇总</p>
              <p className="mt-1.5 text-sm font-bold leading-relaxed text-ink">
                受限领域内引用校验有效，但跨领域结论仍缺少足够证据。
              </p>
            </div>
            <span className="rounded-full bg-card px-2.5 py-1 text-[11px] text-muted">更新于 8 月 23 日</span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            下一步：补充生物医学语料并复跑回归实验，再决定是否更新最终结论。
          </p>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <StatusItem label="执行状态" value="运行完成" tone="success" hint="程序正常结束，输出已保存" />
          <StatusItem label="证据有效性" value="部分有效" tone="warning" hint="12/13 用例通过，存在失败样本" />
          <StatusItem label="研究判断" value="尚不能定论" tone="neutral" hint="需要跨领域数据继续验证" />
        </div>
      </section>

      {activePhase === "experiment" && <ExperimentWorkspace onSelectAsset={onSelectAsset} />}

      {activePhase !== "experiment" && threads.map((thread) => {
        const threadCards = displayCards
          .filter((c) => c.threadId === thread.id)
          .filter(
            (c) =>
              activePhase !== "all" ||
              c.id.startsWith("local-") ||
              !["design", "code", "run"].includes(c.stage),
          )
          .filter(
            (c) =>
              activePhase === "all" ||
              RESEARCH_PHASES.find((phase) => phase.key === activePhase)?.stages.includes(c.stage),
          )
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        return (
          <section key={thread.id} className="rounded-2xl bg-card p-6 shadow-card">
            <header className="flex items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <Workflow className="size-5" strokeWidth={1.8} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-[15px] font-bold text-ink">{thread.title}</h2>
                <p className="mt-0.5 text-xs text-muted">
                  {thread.questionId.toUpperCase()} · 当前阶段
                  <span className="ml-1.5 rounded-full bg-chip px-2 py-0.5 text-[11px] font-medium text-muted">
                    {thread.stage}
                  </span>
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-panel px-2.5 py-1 text-[11px] text-faint">
                  {activePhase === "all" ? `${threadCards.length} 张卡片` : `${threadCards.length} 条记录`}
              </span>
            </header>

            <ol className="relative mt-6 space-y-3 pl-7">
              <span className="absolute bottom-4 left-[11px] top-4 w-px bg-line" aria-hidden />
              {threadCards.map((card, index) => (
                <li
                  key={card.id}
                  className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both relative duration-300"
                  style={{ animationDelay: `${Math.min(index * 50, 250)}ms` }}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "absolute -left-7 top-5 size-[9px] rounded-full border-2 border-card",
                      card.kind === "hint"
                        ? "bg-primary"
                        : card.status === "done"
                          ? "bg-success"
                          : card.status === "doing"
                            ? "bg-brand-blue"
                            : "bg-faint",
                    )}
                  />
                  <ThreadCardRow
                    card={card}
                    selected={selection?.kind === "card" && selection.id === card.id}
                    onSelect={onSelect}
                    onStatusChange={onStatusChange}
                  />
                </li>
              ))}
              {threadCards.length === 0 && (
                <li className="rounded-xl border border-dashed border-line bg-panel px-4 py-8 text-center text-sm text-muted">
                  这个阶段还没有研究记录。
                </li>
              )}
            </ol>
          </section>
        );
      })}

    </div>
  );
}

export function ExperimentWorkspace({ onSelectAsset }: { onSelectAsset?: (assetId: string) => void }) {
  return (
    <section className="rounded-2xl bg-card p-5 shadow-card">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <FlaskConical className="size-5" strokeWidth={1.8} />
          </span>
          <div>
            <h2 className="text-[15px] font-bold text-ink">多轮实验</h2>
            <p className="mt-1 text-xs text-muted">每轮内部依次完成设计、代码、运行和结果判读。</p>
          </div>
        </div>
        <button className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-white">
          <FlaskConical className="size-3.5" strokeWidth={1.8} />
          新建实验轮次
        </button>
      </header>

      <div className="mt-4 space-y-3">
        <ExperimentRound
          number={1}
          title="聚类漏归补聚回归"
          status="分析完成"
          steps={[
            { label: "设计", state: "done" },
            { label: "代码", state: "done" },
            { label: "运行", state: "done" },
            { label: "结果判读", state: "done" },
          ]}
          metrics={[
            { label: "通过用例", value: "12 / 13" },
            { label: "Accuracy", value: "0.6429" },
            { label: "Macro F1", value: "0.6410" },
          ]}
          result="基准程序正常结束，但长文档场景出现 1 个悬空引用。"
          analysis="失败来自跨章节引用编号漂移；本轮结果只能支持受限领域有效，不能证明跨领域同样成立。"
          dataAssetId="a5"
          analysisAssetId="a3"
          codePath="06-code/code_task_run/code_task/workspace/"
          onSelectAsset={onSelectAsset}
        />
        <ExperimentRound
          number={2}
          title="跨领域引用校验"
          status="等待审阅"
          steps={[
            { label: "设计", state: "done" },
            { label: "代码", state: "active" },
            { label: "运行", state: "todo" },
            { label: "结果判读", state: "todo" },
          ]}
          metrics={[
            { label: "验证语料", value: "200 篇" },
            { label: "代码状态", value: "待审阅" },
            { label: "运行结果", value: "未产生" },
          ]}
          result="实验合同和数据范围已经确定，代码变更尚未获准运行。"
          analysis="需要先审阅全局引用编号池方案；当前没有运行数据，因此不能更新研究判断。"
          dataAssetId="a7"
          analysisAssetId="a8"
          codePath="06-code/code_task_run/code_task/workspace/"
          onSelectAsset={onSelectAsset}
        />
      </div>

      <div className="mt-4 rounded-xl border border-dashed border-primary/40 bg-primary-soft/40 p-3.5">
        <p className="text-xs font-bold text-ink">结果判读后的去向</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button className="rounded-lg bg-card px-3 py-2 text-xs text-muted shadow-sm hover:text-primary">修改实验设计</button>
          <button className="flex items-center gap-1.5 rounded-lg bg-card px-3 py-2 text-xs text-muted shadow-sm hover:text-primary"><RotateCcw className="size-3.5" />修改代码并重跑</button>
          <button className="rounded-lg bg-card px-3 py-2 text-xs text-muted shadow-sm hover:text-primary">返回修改假设</button>
          <button className="rounded-lg bg-primary px-3 py-2 text-xs text-white">接受结果并形成结论</button>
        </div>
      </div>
    </section>
  );
}

function ExperimentRound({
  number,
  title,
  status,
  steps,
  metrics,
  result,
  analysis,
  dataAssetId,
  analysisAssetId,
  codePath,
  onSelectAsset,
}: {
  number: number;
  title: string;
  status: string;
  steps: { label: string; state: "done" | "active" | "todo" }[];
  metrics: { label: string; value: string }[];
  result: string;
  analysis: string;
  dataAssetId: string;
  analysisAssetId: string;
  codePath: string;
  onSelectAsset?: (assetId: string) => void;
}) {
  return (
    <article className="rounded-xl border border-line bg-panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-card px-2 py-1 text-[11px] font-medium text-primary">实验 #{number}</span>
          <h3 className="text-sm font-bold text-ink">{title}</h3>
        </div>
        <span className="rounded-full bg-card px-2.5 py-1 text-[11px] text-muted">{status}</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {steps.map((step, index) => (
          <div key={step.label} className="flex items-center gap-1.5">
            <span
              className={cn(
                "flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs",
                step.state === "done" && "bg-success/10 text-success",
                step.state === "active" && "bg-primary-soft text-primary",
                step.state === "todo" && "bg-card text-faint",
              )}
            >
              {step.state === "done" ? <Check className="size-3.5" /> : <Circle className="size-3" />}
              {step.label}
            </span>
            {index < steps.length - 1 && <ChevronRight className="size-3.5 text-faint" aria-hidden />}
          </div>
        ))}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1.05fr_0.95fr]">
        <button
          type="button"
          onClick={() => onSelectAsset?.(dataAssetId)}
          className="cursor-pointer rounded-xl bg-card p-3.5 text-left transition-all hover:-translate-y-0.5 hover:shadow-pop"
        >
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-ink-2">
            <BarChart3 className="size-3.5 text-brand-blue" strokeWidth={1.8} />
            数据结果
            <MoveUpRight className="ml-auto size-3.5 text-faint" strokeWidth={1.8} />
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {metrics.map((metric) => (
              <div key={metric.label} className="min-w-0">
                <p className="truncate text-[10px] text-faint">{metric.label}</p>
                <p className="mt-0.5 truncate text-xs font-bold text-ink">{metric.value}</p>
              </div>
            ))}
          </div>
          <p className="mt-2.5 text-[11px] leading-relaxed text-muted">{result}</p>
          <span className="mt-2 block text-[10px] text-faint">查看关联实验资产</span>
        </button>
        <button
          type="button"
          onClick={() => onSelectAsset?.(analysisAssetId)}
          className="cursor-pointer rounded-xl bg-primary-soft/60 p-3.5 text-left transition-all hover:-translate-y-0.5 hover:bg-primary-soft hover:shadow-pop"
        >
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-primary">
            <BrainCircuit className="size-3.5" strokeWidth={1.8} />
            分析笔记
            <MoveUpRight className="ml-auto size-3.5 text-primary/60" strokeWidth={1.8} />
          </p>
          <p className="mt-2 text-[11px] leading-relaxed text-ink-2">{analysis}</p>
          <span className="mt-2 block text-[10px] text-primary/70">查看关联笔记资产</span>
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        <code className="flex min-w-0 items-center gap-1.5 truncate text-[11px] text-faint">
          <FileCode2 className="size-3.5 shrink-0" />
          {codePath}
        </code>
        <div className="flex gap-1.5">
          <button className="flex items-center gap-1 rounded-lg bg-card px-2.5 py-1.5 text-[11px] text-muted hover:text-primary"><GitCompare className="size-3.5" />查看变更</button>
          <button className="flex items-center gap-1 rounded-lg bg-card px-2.5 py-1.5 text-[11px] text-muted hover:text-primary"><Code2 className="size-3.5" />查看代码</button>
          <button className="flex items-center gap-1 rounded-lg bg-card px-2.5 py-1.5 text-[11px] text-muted hover:text-primary"><Play className="size-3.5" />运行记录</button>
        </div>
      </div>
    </article>
  );
}

function StatusItem({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone: "success" | "warning" | "neutral";
  hint: string;
}) {
  return (
    <div className="rounded-xl bg-panel px-3.5 py-3">
      <p className="text-[11px] text-faint">{label}</p>
      <p
        className={cn(
          "mt-1 text-sm font-bold",
          tone === "success" && "text-success",
          tone === "warning" && "text-primary",
          tone === "neutral" && "text-ink",
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-muted">{hint}</p>
    </div>
  );
}

function ThreadCardRow({
  card,
  selected,
  onSelect,
  onStatusChange,
}: {
  card: ThreadCard;
  selected: boolean;
  onSelect: (cardId: string) => void;
  onStatusChange?: (cardId: string, status: ThreadCard["status"]) => void;
}) {
  const meta = CARD_KIND_META[card.kind];
  const Icon = meta.icon;
  const isHint = card.kind === "hint";

  const cycleStatus = () => {
    if (!onStatusChange) return;
    const next: ThreadCard["status"] =
      card.status === "todo" ? "doing" : card.status === "doing" ? "done" : "todo";
    onStatusChange(card.id, next);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(card.id)}
      onKeyDown={(e) => e.key === "Enter" && onSelect(card.id)}
      className={cn(
        "cursor-pointer rounded-xl border p-4 transition-all",
        isHint
          ? "border-dashed border-primary/40 bg-primary-soft/50 hover:-translate-y-0.5 hover:bg-primary-soft hover:shadow-pop"
          : "border-line/70 bg-card hover:-translate-y-0.5 hover:bg-panel hover:shadow-pop",
        selected && (isHint ? "!border-primary bg-primary-soft shadow-pop" : "border-primary/60 bg-panel shadow-pop"),
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-md", meta.tone)}>
          <Icon className="size-3.5" strokeWidth={1.8} />
        </span>
        <span className="text-xs font-medium text-muted">{meta.label}</span>
        <button
          type="button"
          aria-label={`切换状态(当前:${CARD_STATUS_META[card.status].label})`}
          title={onStatusChange ? "点击切换状态:待办 → 进行中 → 已完成" : undefined}
          disabled={!onStatusChange}
          onClick={(e) => {
            e.stopPropagation();
            cycleStatus();
          }}
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-medium",
            CARD_STATUS_META[card.status].className,
            onStatusChange
              ? "cursor-pointer hover:ring-1 hover:ring-primary/40"
              : "cursor-default",
          )}
        >
          {CARD_STATUS_META[card.status].label}
        </button>
        {card.aiGenerated && (
          <span className="ml-auto flex items-center gap-1 text-[11px] text-faint">
            <span className="inline-flex size-4 items-center justify-center rounded-full bg-primary-soft">
              ✦
            </span>
            AI 生成
          </span>
        )}
      </div>
      <p className="mt-2.5 text-sm font-bold leading-snug text-ink">{card.title}</p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{card.summary}</p>
      <p className="mt-2.5 text-[11px] text-faint">
        {formatDay(card.createdAt)}
        {card.assetRefs.length > 0 && ` · ${card.assetRefs.length} 个关联资产`}
      </p>
    </div>
  );
}
