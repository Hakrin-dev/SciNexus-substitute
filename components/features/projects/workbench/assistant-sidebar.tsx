"use client";

import {
  ArrowRight,
  Bot,
  Languages,
  Lightbulb,
  MessageSquareQuote,
  PanelRightClose,
  SearchCheck,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  ASSET_KIND_META,
  ASSET_STATUS_META,
  CARD_KIND_META,
  CARD_STATUS_META,
  NODE_KIND_META,
  NODE_STATUS_META,
  StateDot,
} from "./workbench-meta";
import { formatDay } from "@/lib/data/workbench";
import type {
  AgentTask,
  JumpableView,
  OutlineNode,
  Selection,
  ThreadCard,
  WorkbenchAsset,
  WorkbenchOverview,
} from "@/lib/data/workbench";

interface Props {
  projectName: string;
  selection: Selection;
  nodes: OutlineNode[];
  cards: ThreadCard[];
  assets: WorkbenchAsset[];
  overview: WorkbenchOverview;
  agentTasks: AgentTask[];
  onSelectAsset: (assetId: string) => void;
  onClear: () => void;
  onJump: (view: JumpableView) => void;
  onGenerate: () => void;
  onClose: () => void;
  className?: string;
}

/**
 * 可折叠右侧 AI 助手栏 —— 选中详情 + AI 建议 + Agent 运行情况,
 * 底部常驻「AI 生成」入口(初稿在中间栏编辑)。折叠由父级控制(不渲染即收起)。
 */
export function AssistantSidebar({
  projectName,
  selection,
  nodes,
  cards,
  assets,
  overview,
  agentTasks,
  onSelectAsset,
  onClear,
  onJump,
  onGenerate,
  onClose,
  className,
}: Props) {
  const running = agentTasks.filter((t) => t.state === "running").length;

  return (
    <aside className={cn("flex flex-col overflow-hidden rounded-2xl bg-card shadow-card", className)}>
      {/* 头部 */}
      <header className="flex shrink-0 items-center gap-2.5 border-b border-line/70 px-5 py-3.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
          <Sparkles className="size-4" strokeWidth={1.8} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-ink">AI 助手</h2>
          <p className="truncate text-[11px] text-faint">{projectName} · 上下文感知</p>
        </div>
        <button
          onClick={onClose}
          aria-label="收起 AI 助手栏"
          className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-faint transition-colors hover:bg-chip hover:text-ink-2"
        >
          <PanelRightClose className="size-4" strokeWidth={1.8} />
        </button>
      </header>

      {/* 滚动内容区 */}
      <div className="scrollbar-subtle flex-1 space-y-5 overflow-y-auto px-5 py-4">
        {selection && (
          <SelectionSection
            selection={selection}
            nodes={nodes}
            cards={cards}
            assets={assets}
            onSelectAsset={onSelectAsset}
            onClear={onClear}
          />
        )}

        {/* AI 建议 */}
        <section>
          <SectionHeader icon={Lightbulb} title="AI 建议" hint="由系统聚合生成" />
          <ul className="mt-2.5 space-y-2">
            {overview.suggestions.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => onJump(item.view)}
                  className="group w-full cursor-pointer rounded-xl bg-panel px-3.5 py-3 text-left text-xs leading-relaxed text-ink transition-all hover:-translate-y-0.5 hover:bg-primary-soft hover:shadow-pop"
                >
                  {item.text}
                  <span className="mt-1 flex items-center gap-1 text-[10px] text-faint transition-colors group-hover:text-primary">
                    前往{VIEW_LABELS[item.view]}
                    <ArrowRight className="size-3" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* Agent 运行情况 */}
        <section>
          <SectionHeader
            icon={Bot}
            title="Agent 运行"
            hint={running > 0 ? `${running} 个运行中` : "全部空闲"}
          />
          <ul className="mt-2.5 space-y-1.5">
            {agentTasks.map((task) => (
              <li
                key={task.id}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs",
                  task.state === "running" ? "bg-panel text-ink" : "text-muted",
                )}
              >
                <StateDot state={task.state} />
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-faint">
                  {task.agent}
                </span>
                <span className="min-w-0 flex-1">{task.label}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* 底部:AI 生成入口 */}
      <footer className="shrink-0 border-t border-line/70 p-4">
        <Button className="w-full" onClick={onGenerate}>
          <Sparkles className="size-4" />
          AI 生成
        </Button>
        <p className="mt-2 text-center text-[10px] leading-relaxed text-faint">
          开题报告 / 文献综述 / 组会PPT · 初稿在中间栏编辑
        </p>
      </footer>
    </aside>
  );
}

const VIEW_LABELS = {
  outline: "大纲",
  thread: "线程",
  assets: "资产库",
  log: "日志",
} as const;

function SectionHeader({
  icon: Icon,
  title,
  hint,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  hint: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="size-4 text-primary" strokeWidth={1.8} />
      <h3 className="text-[13px] font-bold text-ink">{title}</h3>
      <span className="ml-auto text-[10px] text-faint">{hint}</span>
    </div>
  );
}

/** 选中详情:节点 / 卡片 / 资产,联动显示在助手栏顶部 */
function SelectionSection({
  selection,
  nodes,
  cards,
  assets,
  onSelectAsset,
  onClear,
}: {
  selection: NonNullable<Selection>;
  nodes: OutlineNode[];
  cards: ThreadCard[];
  assets: WorkbenchAsset[];
  onSelectAsset: (id: string) => void;
  onClear: () => void;
}) {
  let body: React.ReactNode = null;
  let title = "";
  let badge = "";

  if (selection.kind === "node") {
    const node = findNode(nodes, selection.id);
    if (node) {
      title = node.title;
      badge = `${NODE_KIND_META[node.kind].label} · ${NODE_STATUS_META[node.status].label}`;
      body = (
        <>
          {node.detail && <p className="text-xs leading-relaxed text-muted">{node.detail}</p>}
          {node.aiNote && <AiNote text={node.aiNote} />}
          <AssetRefs refs={node.assetRefs} assets={assets} onSelectAsset={onSelectAsset} />
          <QuickActions />
        </>
      );
    }
  } else if (selection.kind === "card") {
    const card = cards.find((c) => c.id === selection.id);
    if (card) {
      title = card.title;
      badge = `${CARD_KIND_META[card.kind].label} · ${CARD_STATUS_META[card.status].label}`;
      body = (
        <>
          <p className="text-xs leading-relaxed text-muted">{card.summary}</p>
          {card.aiGenerated && <AiNote text="本卡片由 Agent 自动生成,可追问、修改或确认。" />}
          <p className="text-[11px] text-faint">创建于 {formatDay(card.createdAt)}</p>
          <AssetRefs refs={card.assetRefs} assets={assets} onSelectAsset={onSelectAsset} />
          <QuickActions />
        </>
      );
    }
  } else {
    const asset = assets.find((a) => a.id === selection.id);
    if (asset) {
      title = asset.title;
      badge = `${ASSET_KIND_META[asset.kind].label} · ${ASSET_STATUS_META[asset.status].label}`;
      body = (
        <>
          <p className="text-xs text-muted">{asset.meta}</p>
          <div className="flex flex-wrap gap-1.5">
            {asset.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-chip px-2.5 py-1 text-[10px] text-muted">
                #{tag}
              </span>
            ))}
          </div>
          {(asset.questionIds.length > 0 || asset.hypothesisIds.length > 0) && (
            <p className="text-xs text-muted">
              <span className="text-[11px] text-faint">关联 </span>
              {[...asset.questionIds, ...asset.hypothesisIds].map((id) => id.toUpperCase()).join(" · ")}
            </p>
          )}
          <p className="text-[11px] text-faint">更新于 {formatDay(asset.updatedAt)}</p>
          <QuickActions />
        </>
      );
    }
  }

  if (!body) return null;
  return (
    <section className="rounded-xl bg-panel p-3.5">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[13px] font-bold leading-snug text-ink">{title}</p>
          <span className="mt-1 w-fit rounded-full bg-card px-2 py-0.5 text-[10px] text-muted shadow-card">
            {badge}
          </span>
        </div>
        <button
          onClick={onClear}
          aria-label="取消选中"
          className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-faint transition-colors hover:bg-chip hover:text-ink-2"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <div className="mt-3 space-y-2.5">{body}</div>
    </section>
  );
}

function AiNote({ text }: { text: string }) {
  return (
    <div className="rounded-lg bg-primary-soft/60 p-3">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-primary">
        <Sparkles className="size-3" />
        AI 分析
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-muted">{text}</p>
    </div>
  );
}

function QuickActions() {
  const actions = [
    { icon: MessageSquareQuote, label: "总结这段" },
    { icon: Languages, label: "翻译" },
    { icon: SearchCheck, label: "找反驳证据" },
  ];
  return (
    <div className="flex flex-wrap gap-1.5">
      {actions.map(({ icon: Icon, label }) => (
        <button
          key={label}
          className="flex h-6.5 cursor-pointer items-center gap-1 rounded-full bg-chip px-2.5 text-[11px] text-muted transition-colors hover:bg-primary-soft hover:text-primary"
        >
          <Icon className="size-3" strokeWidth={1.8} />
          {label}
        </button>
      ))}
    </div>
  );
}

function AssetRefs({
  refs,
  assets,
  onSelectAsset,
}: {
  refs: string[];
  assets: WorkbenchAsset[];
  onSelectAsset: (id: string) => void;
}) {
  const resolved = refs.map((refId) => assets.find((a) => a.id === refId)).filter(Boolean);
  if (resolved.length === 0) return null;
  return (
    <div>
      <p className="text-[11px] font-medium text-faint">关联资产</p>
      <ul className="mt-1.5 space-y-0.5">
        {resolved.map((asset) => {
          const meta = ASSET_KIND_META[asset!.kind];
          return (
            <li key={asset!.id}>
              <button
                onClick={() => onSelectAsset(asset!.id)}
                className="w-full cursor-pointer truncate rounded-lg px-2 py-1.5 text-left text-xs text-ink-2 transition-colors hover:bg-chip"
              >
                <span className={cn("mr-1.5 rounded px-1 py-0.5 text-[10px]", meta.tone)}>{meta.label}</span>
                {asset!.title}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function findNode(nodes: OutlineNode[], id: string): OutlineNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const hit = findNode(node.children, id);
    if (hit) return hit;
  }
  return null;
}
