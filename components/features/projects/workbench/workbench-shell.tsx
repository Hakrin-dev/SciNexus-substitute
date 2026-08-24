"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  ListTree,
  Pencil,
  ScrollText,
  Settings2,
  Sparkles,
  Table2,
  Workflow,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
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
import type { JumpableView, WorkbenchView } from "@/lib/data/workbench";
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
 * 课题工作台壳 `/projects/[id]` —— 左大纲轨 + 主工作区(五视图) + 右上下文面板 + 底部 Agent 栏。
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
  const jumpTo = (next: JumpableView) => setView(next);

  const selectAssetAndShow = (assetId: string) => {
    setSelection({ kind: "asset", id: assetId });
    if (view !== "assets") setView("assets");
  };

  const activeQuestionId =
    selection?.kind === "node"
      ? topLevelQuestionOf(selection.id, threads[0]?.questionId)
      : threads[0]?.questionId;

  return (
    <AppShell>
      <div className="mx-auto max-w-[1280px] space-y-5 px-8 py-8">
        {/* 项目头部 */}
        <header className="rounded-2xl bg-card p-6 shadow-card">
          <div className="flex items-start gap-5">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-lg font-bold text-primary">
              {project.name.slice(0, 1)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                <h1 className="truncate text-xl font-bold text-ink">{project.name}</h1>
                <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary">
                  {project.status}
                </span>
                <span className="hidden items-center gap-1 rounded-full bg-chip px-2.5 py-1 text-xs text-muted sm:flex">
                  <Sparkles className="size-3 text-primary" />
                  科研 IDE 工作台
                </span>
              </div>
              <p className="mt-1 truncate text-sm text-muted">{project.tagline}</p>
            </div>
            <div className="hidden shrink-0 gap-2 md:flex">
              <ProposalGenerator projectName={project.name} />
              <Button variant="outline" size="sm">
                <Pencil className="size-3.5" />
                编辑
              </Button>
              <Button variant="outline" size="sm">
                <Settings2 className="size-3.5" />
                设置
              </Button>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-chip">
              <div
                className="h-full rounded-full bg-primary transition-[width]"
                style={{ width: `${project.progress}%` }}
              />
            </div>
            <span className="text-sm font-semibold text-ink">{project.progress}%</span>
          </div>

          {/* 视图 Tab */}
          <nav className="mt-4 flex flex-wrap gap-1.5 border-t border-line pt-4">
            {VIEW_TABS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setView(value)}
                className={cn(
                  "flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors",
                  view === value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted hover:bg-chip hover:text-ink",
                )}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            ))}
          </nav>
        </header>

        {/* 三栏:左大纲轨 + 主工作区 + 右上下文面板 */}
        <div className="grid items-start gap-5 lg:grid-cols-[230px_minmax(0,1fr)] xl:grid-cols-[230px_minmax(0,1fr)_300px]">
          <OutlineRail
            nodes={outline}
            activeQuestionId={activeQuestionId}
            onSelect={(nodeId) => {
              setSelection({ kind: "node", id: nodeId });
              if (view !== "outline") setView("outline");
            }}
            className="sticky top-20 hidden self-start lg:block"
          />

          <main className="min-w-0 space-y-5">
            {view === "overview" && <OverviewView project={project} overview={overview} onJump={jumpTo} />}
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
          </main>

          <ContextPanel
            selection={selection}
            nodes={outline}
            cards={cards}
            assets={assets}
            overview={overview}
            onSelectAsset={selectAssetAndShow}
            className="sticky top-20 hidden self-start xl:block"
          />
        </div>

        <AgentStatusBar tasks={agentTasks} />
      </div>
    </AppShell>
  );
}

/** 选中节点所属的顶层研究问题 id(用于左轨高亮);找不到时回落当前线程问题 */
function topLevelQuestionOf(nodeId: string, fallback?: string): string | undefined {
  if (nodeId.startsWith("q")) return nodeId;
  return fallback;
}
