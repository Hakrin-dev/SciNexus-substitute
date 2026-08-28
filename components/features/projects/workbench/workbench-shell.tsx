"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  LayoutDashboard,
  ListTree,
  PanelRight,
  PanelRightClose,
  ScrollText,
  Table2,
  Workflow,
} from "lucide-react";
import { ProposalStudio } from "@/components/features/projects/proposal-studio";
import { cn } from "@/lib/utils";
import {
  useAgentTasks,
  useProject,
  useProjectOutline,
  useProjectThreads,
  useThreadCards,
  useUpdateThreadCardStatus,
  useWorkbenchActivity,
  useWorkbenchAssets,
  useWorkbenchOverview,
} from "@/lib/api/services";
import { apiPut } from "@/lib/api/client";
import { useDemoState } from "@/stores/demo-state";
import { toast } from "@/stores/toast";
import type {
  ResearchStageKey,
  Selection,
  ThreadCard,
  WorkbenchAsset,
  WorkbenchView,
} from "@/lib/data/workbench";
import { OutlineRail, type ResearchInputPhase } from "./outline-rail";
import { OutlineView } from "./outline-view";
import { ThreadView } from "./thread-view";
import { AssetTableView } from "./asset-table-view";
import { LogView } from "./log-view";
import { OverviewView } from "./overview-view";
import { AssistantSidebar } from "./assistant-sidebar";

const VIEW_TABS = [
  { value: "overview", label: "概览", icon: LayoutDashboard },
  { value: "thread", label: "研究过程", icon: Workflow },
  { value: "outline", label: "大纲", icon: ListTree },
  { value: "assets", label: "资产", icon: Table2 },
  { value: "log", label: "日志", icon: ScrollText },
] as const;

const VIEW_VALUES = new Set<string>(VIEW_TABS.map((t) => t.value));

const EXPERIMENT_LINKED_ASSETS: WorkbenchAsset[] = [
  {
    id: "a7",
    kind: "experiment",
    title: "跨领域引用校验实验 #2",
    meta: "实验合同 + 待审阅代码方案",
    questionIds: ["q1"],
    hypothesisIds: ["h2"],
    status: "active",
    tags: ["跨领域验证", "实验 #2"],
    updatedAt: "2026-08-23T18:00:00+08:00",
  },
  {
    id: "a8",
    kind: "note",
    title: "跨领域实验 #2 分析与审阅笔记",
    meta: "Markdown · 等待代码审阅",
    questionIds: ["q1"],
    hypothesisIds: ["h2"],
    status: "active",
    tags: ["结果判读", "实验 #2"],
    updatedAt: "2026-08-23T18:00:00+08:00",
  },
];

/**
 * 课题工作台 `/projects/[id]` —— 左大纲轨 + 主工作区(五视图 / AI 生成工作台) + 可折叠右侧助手栏。
 * 视图状态走 URL `?view=`;助手栏含 AI 建议、Agent 运行与「AI 生成」入口,初稿在中间栏编辑。
 */
export function WorkbenchShell({ projectId }: { projectId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawView = searchParams.get("view") ?? "";
  const view: WorkbenchView = VIEW_VALUES.has(rawView) ? (rawView as WorkbenchView) : "thread";

  const [selection, setSelection] = useState<Selection>(null);
  const [localResearchCards, setLocalResearchCards] = useState<ThreadCard[]>([]);
  /** AI 助手首次进入默认收起,仅由用户点击侧边栏按钮展开。 */
  const [sidebarOpen, setPanelOverride] = useState(false);
  /** AI 生成工作台(中间栏内联编辑);支持 ?studio=1 深链 */
  const [studioOpen, setStudioOpen] = useState(searchParams.get("studio") === "1");

  const { data: project } = useProject(projectId);
  const { data: outline = [] } = useProjectOutline(projectId);
  const { data: threads = [] } = useProjectThreads(projectId);
  const { data: cards = [] } = useThreadCards(projectId);
  const { data: loadedAssets = [] } = useWorkbenchAssets(projectId);
  const assets = [
    ...loadedAssets,
    ...EXPERIMENT_LINKED_ASSETS.filter(
      (candidate) => !loadedAssets.some((asset) => asset.id === candidate.id),
    ),
  ];
  const { data: activity = [] } = useWorkbenchActivity(projectId);
  const { data: overview } = useWorkbenchOverview(projectId);
  const { data: agentTasks = [] } = useAgentTasks(projectId);
  const updateCardStatus = useUpdateThreadCardStatus(projectId);

  const queryClient = useQueryClient();
  const archiveProject = useDemoState((s) => s.archiveDemoProject);
  const [archiving, setArchiving] = useState(false);

  const handleArchive = async () => {
    if (!project) return;
    setArchiving(true);
    archiveProject(project.id);
    try {
      await apiPut(`/api/projects/${project.id}`, { status: "已搁置" });
    } catch {
      /* 演示态项目无后端记录,忽略接口错误 */
    }
    await queryClient.invalidateQueries({ queryKey: ["api", "projects"] });
    await queryClient.invalidateQueries({ queryKey: ["api", "project", project.id] });
    toast.success(`「${project.name}」已归档，可在「归档项目」中恢复`);
    setArchiving(false);
    router.push("/my-projects");
  };

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

  const addResearchEntry = (phase: ResearchInputPhase, text: string) => {
    const thread = threads[0];
    if (!thread) return;
    const stageByPhase: Record<ResearchInputPhase, ResearchStageKey> = {
      plan: "plan",
      search: "search",
      read: "read",
      synthesize: "synthesize",
      experiment: "design",
      report: "report",
    };
    const labelByPhase: Record<ResearchInputPhase, string> = {
      plan: "计划",
      search: "检索",
      read: "阅读",
      synthesize: "综合",
      experiment: "实验",
      report: "报告",
    };
    const now = Date.now();
    const stage = stageByPhase[phase];
    const label = labelByPhase[phase];
    setLocalResearchCards((current) => [
      ...current,
      {
        id: `local-user-${now}`,
        threadId: thread.id,
        kind: "next",
        stage,
        title: `用户补充 · ${label}`,
        summary: text,
        status: "todo",
        assetRefs: [],
        createdAt: new Date(now).toISOString(),
      },
      {
        id: `local-ai-${now}`,
        threadId: thread.id,
        kind: "hint",
        stage,
        title: "AI 初步整理",
        summary: `已将内容归入「${label}」。建议核对相关证据与资产，再决定是否更新研究判断。`,
        status: "todo",
        assetRefs: [],
        aiGenerated: true,
        createdAt: new Date(now + 1).toISOString(),
      },
    ]);
    if (view !== "thread") setView("thread");
  };

  return (
    <div
      className={cn(
        "mx-auto px-6 py-7 lg:px-8 lg:py-9",
        sidebarOpen ? "max-w-[1500px]" : "max-w-[1280px]",
      )}
    >
      {/* 页面级头部:标题 + 徽章 + 副标题;右侧仅保留助手栏开关 */}
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
        <div className="flex shrink-0 items-center gap-2">
          {project.status === "进行中" && (
            <button
              onClick={() => void handleArchive()}
              disabled={archiving}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-line bg-card px-3 text-[13px] text-muted shadow-card transition-colors hover:bg-chip hover:text-ink"
            >
              <Archive className="size-3.5" strokeWidth={1.8} />
              {archiving ? "归档中…" : "归档"}
            </button>
          )}
          <button
            onClick={() => setPanelOverride(!sidebarOpen)}
            aria-label={sidebarOpen ? "收起 AI 助手栏" : "展开 AI 助手栏"}
            title={sidebarOpen ? "收起 AI 助手栏" : "展开 AI 助手栏"}
            className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-line bg-card text-ink-2 shadow-card transition-colors hover:bg-chip hover:text-primary"
          >
            {sidebarOpen ? (
              <PanelRightClose className="size-4" strokeWidth={1.8} />
            ) : (
              <PanelRight className="size-4" strokeWidth={1.8} />
            )}
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

      {/* 三栏:左大纲轨 + 主工作区 + 可折叠助手栏(宽度≈中间栏,略小) */}
      <div
        className={cn(
          "mt-4 grid items-start gap-5 lg:grid-cols-[240px_minmax(0,1fr)]",
          sidebarOpen && "xl:grid-cols-[240px_minmax(0,1.05fr)_minmax(0,0.95fr)]",
        )}
      >
        <OutlineRail
          nodes={outline}
          activeQuestionId={activeQuestionId}
          onSelect={(nodeId) => {
            setSelection({ kind: "node", id: nodeId });
            if (view !== "outline") setView("outline");
          }}
          onAddResearchEntry={addResearchEntry}
          className="sticky top-20 hidden self-start lg:block"
        />

        <main
          key={studioOpen ? "studio" : view}
          className="animate-in fade-in slide-in-from-bottom-2 min-w-0 space-y-5 duration-300"
        >
          {studioOpen ? (
            <ProposalStudio projectName={project.name} onExit={() => setStudioOpen(false)} />
          ) : (
            <>
              {view === "overview" && (
                <OverviewView project={project} overview={overview} onJump={jumpTo} />
              )}
              {view === "thread" && (
                <ThreadView
                  threads={threads}
                  cards={cards}
                  localCards={localResearchCards}
                  selection={selection}
                  onSelect={(cardId) => setSelection({ kind: "card", id: cardId })}
                  onSelectAsset={selectAssetAndShow}
                  onPhaseSelect={(phaseId) =>
                    setSelection(phaseId ? { kind: "phase", id: phaseId } : null)
                  }
                  onStatusChange={(cardId, status) =>
                    updateCardStatus.mutate({ cardId, status })
                  }
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
            </>
          )}
        </main>

        {/* 桌面端:助手栏作为栅格列(可折叠) */}
        {sidebarOpen && (
          <AssistantSidebar
            projectName={project.name}
            selection={selection}
            nodes={outline}
            cards={cards}
            assets={assets}
            overview={overview}
            agentTasks={agentTasks}
            onSelectAsset={selectAssetAndShow}
            onClear={() => setSelection(null)}
            onJump={jumpTo}
            onGenerate={() => setStudioOpen(true)}
            onClose={() => setPanelOverride(false)}
            className="sticky top-20 hidden max-h-[calc(100vh-6.5rem)] self-start xl:flex"
          />
        )}
      </div>

      {/* 窄屏:助手栏以抽屉呈现 */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 xl:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-ink/40"
            onClick={() => setPanelOverride(false)}
            role="presentation"
          />
          <AssistantSidebar
            projectName={project.name}
            selection={selection}
            nodes={outline}
            cards={cards}
            assets={assets}
            overview={overview}
            agentTasks={agentTasks}
            onSelectAsset={(id) => {
              selectAssetAndShow(id);
              setPanelOverride(false);
            }}
            onClear={() => setSelection(null)}
            onJump={(v) => {
              jumpTo(v);
              setPanelOverride(false);
            }}
            onGenerate={() => {
              setStudioOpen(true);
              setPanelOverride(false);
            }}
            onClose={() => setPanelOverride(false)}
            className="absolute inset-y-0 right-0 max-h-none w-[min(440px,92vw)] rounded-none rounded-l-2xl"
          />
        </div>
      )}
    </div>
  );
}

/** 选中节点所属的顶层研究问题 id(用于左轨高亮);找不到时回落当前线程问题 */
function topLevelQuestionOf(nodeId: string, fallback?: string): string | undefined {
  if (nodeId.startsWith("q")) return nodeId;
  return fallback;
}
