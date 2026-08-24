"use client";

import { Languages, MessageSquareQuote, SearchCheck, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ASSET_KIND_META,
  ASSET_STATUS_META,
  CARD_KIND_META,
  CARD_STATUS_META,
  NODE_KIND_META,
  NODE_STATUS_META,
} from "./workbench-meta";
import { formatDay } from "@/lib/data/workbench";
import type { OutlineNode, Selection, ThreadCard, WorkbenchAsset, WorkbenchOverview } from "@/lib/data/workbench";

interface Props {
  selection: Selection;
  nodes: OutlineNode[];
  cards: ThreadCard[];
  assets: WorkbenchAsset[];
  overview: WorkbenchOverview;
  onSelectAsset: (assetId: string) => void;
  className?: string;
}

/** 右栏上下文面板 —— 未选中时显示项目级 AI 建议;选中节点/卡片/资产后联动详情 */
export function ContextPanel({ selection, nodes, cards, assets, overview, onSelectAsset, className }: Props) {
  const content = renderContent(selection);
  return <div className={className}>{content}</div>;

  function renderContent(sel: Selection) {
    if (!sel) return <ProjectSuggestions overview={overview} />;

    if (sel.kind === "node") {
      const node = findNode(nodes, sel.id);
      if (node) return <NodeDetail node={node} assets={assets} onSelectAsset={onSelectAsset} />;
    }
    if (sel.kind === "card") {
      const card = cards.find((c) => c.id === sel.id);
      if (card) return <CardDetail card={card} assets={assets} onSelectAsset={onSelectAsset} />;
    }
    if (sel.kind === "asset") {
      const asset = assets.find((a) => a.id === sel.id);
      if (asset) return <AssetDetail asset={asset} />;
    }
    return <ProjectSuggestions overview={overview} />;
  }
}

function PanelShell({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <aside className="space-y-4 rounded-2xl bg-card p-5 shadow-card">
      <div className="flex items-center gap-2">
        <h2 className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink">{title}</h2>
        {badge && (
          <span className="shrink-0 rounded-full bg-chip px-2 py-0.5 text-[11px] text-muted">{badge}</span>
        )}
      </div>
      {children}
    </aside>
  );
}

function AiNote({ text }: { text: string }) {
  return (
    <div className="rounded-xl bg-primary-soft/60 p-3.5">
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
          className="cursor-pointer rounded-full border border-line px-2.5 py-1 text-[11px] text-muted transition-colors hover:bg-chip"
        >
          <Icon className="mr-1 inline size-3" />
          {label}
        </button>
      ))}
    </div>
  );
}

function AssetRefList({
  refs,
  assets,
  onSelectAsset,
}: {
  refs: string[];
  assets: WorkbenchAsset[];
  onSelectAsset: (id: string) => void;
}) {
  if (refs.length === 0) return null;
  return (
    <div>
      <p className="text-[11px] font-medium text-faint">关联资产</p>
      <ul className="mt-1.5 space-y-1">
        {refs.map((refId) => {
          const asset = assets.find((a) => a.id === refId);
          if (!asset) return null;
          const meta = ASSET_KIND_META[asset.kind];
          return (
            <li key={refId}>
              <button
                onClick={() => onSelectAsset(asset.id)}
                className="w-full cursor-pointer truncate rounded-lg px-2.5 py-1.5 text-left text-xs text-ink-2 transition-colors hover:bg-chip"
              >
                <span className={cn("mr-1.5 rounded px-1 py-0.5 text-[10px]", meta.tone)}>{meta.label}</span>
                {asset.title}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ProjectSuggestions({ overview }: { overview: WorkbenchOverview }) {
  return (
    <PanelShell title="AI 建议">
      <AiNote
        text={`当前聚焦 ${overview.focus.questionId.toUpperCase()}:${overview.focus.question}`}
      />
      <ul className="space-y-2">
        {overview.suggestions.map((item) => (
          <li key={item.id} className="rounded-xl bg-chip px-3.5 py-2.5 text-xs leading-relaxed text-muted">
            {item.text}
          </li>
        ))}
      </ul>
      <p className="text-[11px] leading-relaxed text-faint">
        选中的大纲节点、线程卡片或资产将在此显示详情与分析。
      </p>
    </PanelShell>
  );
}

function NodeDetail({
  node,
  assets,
  onSelectAsset,
}: {
  node: OutlineNode;
  assets: WorkbenchAsset[];
  onSelectAsset: (id: string) => void;
}) {
  const meta = NODE_KIND_META[node.kind];
  const status = NODE_STATUS_META[node.status];
  return (
    <PanelShell title={node.title} badge={`${meta.label} · ${status.label}`}>
      {node.detail && <p className="text-xs leading-relaxed text-muted">{node.detail}</p>}
      {node.aiNote && <AiNote text={node.aiNote} />}
      <AssetRefList refs={node.assetRefs} assets={assets} onSelectAsset={onSelectAsset} />
      <QuickActions />
    </PanelShell>
  );
}

function CardDetail({
  card,
  assets,
  onSelectAsset,
}: {
  card: ThreadCard;
  assets: WorkbenchAsset[];
  onSelectAsset: (id: string) => void;
}) {
  const meta = CARD_KIND_META[card.kind];
  const status = CARD_STATUS_META[card.status];
  return (
    <PanelShell title={card.title} badge={`${meta.label} · ${status.label}`}>
      <p className="text-xs leading-relaxed text-muted">{card.summary}</p>
      {card.aiGenerated && <AiNote text="本卡片由 Agent 自动生成,可追问、修改或确认。" />}
      <p className="text-[11px] text-faint">创建于 {formatDay(card.createdAt)}</p>
      <AssetRefList refs={card.assetRefs} assets={assets} onSelectAsset={onSelectAsset} />
      <QuickActions />
    </PanelShell>
  );
}

function AssetDetail({ asset }: { asset: WorkbenchAsset }) {
  const meta = ASSET_KIND_META[asset.kind];
  const status = ASSET_STATUS_META[asset.status];
  return (
    <PanelShell title={asset.title} badge={`${meta.label} · ${status.label}`}>
      <p className="text-xs text-muted">{asset.meta}</p>
      <div className="flex flex-wrap gap-1.5">
        {asset.tags.map((tag) => (
          <span key={tag} className="rounded-lg bg-chip px-2 py-1 text-[11px] text-muted">
            {tag}
          </span>
        ))}
      </div>
      {(asset.questionIds.length > 0 || asset.hypothesisIds.length > 0) && (
        <div>
          <p className="text-[11px] font-medium text-faint">关联</p>
          <p className="mt-1 text-xs text-muted">
            {[...asset.questionIds, ...asset.hypothesisIds].map((id) => id.toUpperCase()).join(" · ")}
          </p>
        </div>
      )}
      <p className="text-[11px] text-faint">更新于 {formatDay(asset.updatedAt)}</p>
      <QuickActions />
    </PanelShell>
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
