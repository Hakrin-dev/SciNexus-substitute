"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  ListTree,
  Pencil,
  ScrollText,
  Settings2,
  Table2,
  Workflow,
} from "lucide-react";
import { ProposalGenerator } from "@/components/features/projects/proposal-generator";
import { cn } from "@/lib/utils";
import {
  useAgentTasks,
  useProject,
  useProjectOutline,
  useProjectThreads,
  useThreadCards,
  useWorkbenchActivity,
  useWorkbenchAssets,
  useWorkbenchOverview,
} from "@/lib/api/services";
import type { WorkbenchView } from "@/lib/data/workbench";
import { OutlineRail } from "./outline-rail";
import { OutlineView } from "./outline-view";
import { ThreadView } from "./thread-view";
import { AssetTableView } from "./asset-table-view";
import { LogView } from "./log-view";
import { OverviewView } from "./overview-view";
import { ContextPanel } from "./context-panel";
import { AgentStatusBar } from "./agent-status-bar";

const VIEW_TABS = [
  { value: "overview", label: "概览", icon: LayoutDashboard },
  { value: "thread", label: "线程", icon: Workflow },
  { value: "outline", label: "大纲", icon: ListTree },
  { value: "assets", label: "资产", icon: Table2 },
  { value: "log", label: "日志", icon: ScrollText },
] as const;

const VIEW_VALUES = new Set<string>(VIEW_TABS.map((t) => t.value));

/**
 * 课题工作台 `/projects/[id]` —— 左大纲轨 + 主工作区(五视图) + 右上下文面板 + 底部 Agent 栏。
 * 视图状态走 URL `?view=`,选中上下文在视图切换间保留。
 */
export function WorkbenchShell({ projectId }: { projectId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawView = searchParams.get("view") ?? "";
  const view: WorkbenchView = VIEW_VALUES.has(rawView) ? (rawView as WorkbenchView) : "thread";

  const [selection, setSelection] = useState<
    { kind: "node" | "card" | "asset"; id: string } | null
  >(null);

  const { data: project } = useProject(projectId);
  const { data: outline = [] } = useProjectOutline(projectId);
  const { data: threads = [] } = useProjectThreads(projectId);
  const { data: cards = [] } = useThreadCards(projectId);
  const { data: assets = [] } = useWorkbenchAssets(projectId);
  const { data: activity = [] } = useWorkbenchActivity(projectId);
  const { data: overview } = useWorkbenchOverview(projectId);
  const { data: agentTasks = [] } = useAgentTasks(projectId);

  if (!project || !overview) return null;

  const setView = (next: WorkbenchView) =>
    router.replace(`/projects/${projectId}?view=${next}`, { scroll: false });

  /** 跳转视图(概览阻塞项/AI 建议入口);选中上下文保留 */
  const jumpTo = (next: Exclude<WorkbenchView, "overview">) => setView(next);

  const selectAssetAndShow = (assetId: string) => {
    setSelection({ kind: "asset", id: assetId });
    if (view !== "assets") setView("assets");
  };

  const activeQuestionId =
    selection?.kind === "node"
      ? topLevelQuestionOf(selection.id, threads[0]?.questionId)
      : threads[0]?.questionId;

  const doneMilestones = project.milestones.filter((m) => m.status === "done").length;

  return (
    <div className="mx-auto max-w-[1280px] px-6 py-7 lg:px-8 lg:py-9">
      {/* 页面级头部:标题 + 徽章 + 副标题 + 操作 */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-ink">{project.name}</h1>
            <span className="rounded-full bg-primary-soft px-2.5 py-1 text-[11px] font-medium text-primary">
              科研 IDE 工作台
            </span>
            <span className="rounded-full bg-chip px-2.5 py-1 text-[11px] font-medium text-muted">
              {project.status}
            </span>
          </div>
          <p className="mt-1.5 truncate text-sm text-muted">{project.tagline}</p>
          <div className="mt-2.5 flex items-center gap-3">
            <div className="h-1.5 w-44 overflow-hidden rounded-full bg-chip">
              <div
                className="h-full rounded-full bg-primary transition-[width]"
                style={{ width: `${project.progress}%` }}
              />
            </div>
            <span className="text-xs text-muted">
              进度 {project.progress}% · 里程碑 {doneMilestones}/{project.milestones.length}
            </span>
          </div>
        </div>
        <div className="hidden shrink-0 gap-2 md:flex">
          <ProposalGenerator projectName={project.name} />
          <button className="flex h-9 items-center gap-2 rounded-lg border border-line bg-card px-3.5 text-xs font-medium text-ink-2 shadow-card transition-colors hover:bg-chip hover:text-primary">
            <Pencil className="size-3.5" />
            编辑
          </button>
          <button className="flex size-9 items-center justify-center rounded-lg border border-line bg-card text-ink-2 shadow-card transition-colors hover:bg-chip hover:text-primary">
            <Settings2 className="size-4" />
            <span className="sr-only">项目设置</span>
          </button>
        </div>
      </header>

      {/* 视图 Tab 行 */}
      <nav className="mt-5 flex flex-wrap items-center gap-1.5">
        {VIEW_TABS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => setView(value)}
            className={cn(
              "flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-[13px] transition-colors",
              view === value
                ? "bg-primary font-medium text-white"
                : "bg-chip text-muted hover:text-ink",
            )}
          >
            <Icon className="size-3.5" strokeWidth={1.8} />
            {label}
          </button>
        ))}
      </nav>

      {/* 三栏:左大纲轨 + 主工作区 + 右上下文面板(概览视图自带右列,隐藏面板避免重复) */}
      <div
        className={cn(
          "mt-4 grid items-start gap-5 lg:grid-cols-[240px_minmax(0,1fr)]",
          view !== "overview" && "xl:grid-cols-[240px_minmax(0,1fr)_300px]",
        )}
      >
        <OutlineRail
          nodes={outline}
          activeQuestionId={activeQuestionId}
          onSelect={(nodeId) => {
            setSelection({ kind: "node", id: nodeId });
            if (view !== "outline") setView("outline");
          }}
          className="sticky top-20 hidden self-start lg:block"
        />

        <motion.main
          key={view}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="min-w-0 space-y-5"
        >
          {view === "overview" && (
            <OverviewView project={project} overview={overview} onJump={jumpTo} />
          )}
          {view === "thread" && (
            <ThreadView
              threads={threads}
              cards={cards}
              selection={selection}
              onSelect={(cardId) => setSelection({ kind: "card", id: cardId })}
            />
          )}
          {view === "outline" && (
            <OutlineView
              nodes={outline}
              selection={selection}
              onSelect={(nodeId) => setSelection({ kind: "node", id: nodeId })}
            />
          )}
          {view === "assets" && (
            <AssetTableView
              assets={assets}
              selection={selection}
              onSelect={(assetId) => setSelection({ kind: "asset", id: assetId })}
            />
          )}
          {view === "log" && <LogView entries={activity} />}
        </motion.main>

          {view !== "overview" && (
            <ContextPanel
              selection={selection}
              nodes={outline}
              cards={cards}
              assets={assets}
              overview={overview}
              onSelectAsset={selectAssetAndShow}
              onClear={() => setSelection(null)}
              className="sticky top-20 hidden self-start xl:block"
            />
          )}
      </div>

      {/* 底部 Agent 栏 */}
      <AgentStatusBar tasks={agentTasks} className="mt-5" />
    </div>
  );
}

/** 选中节点所属的顶层研究问题 id(用于左轨高亮);找不到时回落当前线程问题 */
function topLevelQuestionOf(nodeId: string, fallback?: string): string | undefined {
  if (nodeId.startsWith("q")) return nodeId;
  return fallback;
}
