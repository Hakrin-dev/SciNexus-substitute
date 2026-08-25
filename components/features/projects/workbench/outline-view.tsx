"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, ListTree } from "lucide-react";
import { cn } from "@/lib/utils";
import { NODE_KIND_META, NODE_STATUS_META } from "./workbench-meta";
import { flattenOutline } from "@/lib/data/workbench";
import type { OutlineNode, Selection } from "@/lib/data/workbench";

interface Props {
  nodes: OutlineNode[];
  selection: Selection;
  onSelect: (nodeId: string) => void;
}

/** 大纲视图 —— 完整 Q/H/E/C 层级树,可折叠、选中联动右栏 */
export function OutlineView({ nodes, selection, onSelect }: Props) {
  const flat = flattenOutline(nodes);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const collapsibleIds = flat.filter((n) => n.children.length > 0).map((n) => n.id);

  return (
    <section className="rounded-2xl bg-card p-6 shadow-card">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <ListTree className="size-5" strokeWidth={1.8} />
          </span>
          <div>
            <h2 className="text-[15px] font-bold text-ink">研究大纲</h2>
            <p className="mt-0.5 text-xs text-muted">问题 → 假设 → 证据 → 结论 · 点击节点查看右栏详情</p>
          </div>
        </div>
        {collapsibleIds.length > 0 && (
          <button
            onClick={() => setCollapsed(new Set(collapsibleIds))}
            className="flex h-8 cursor-pointer items-center rounded-lg border border-line bg-card px-3 text-xs font-medium text-ink-2 shadow-card transition-colors hover:bg-chip hover:text-primary"
          >
            全部折叠
          </button>
        )}
      </header>

      <ul className="mt-5 space-y-0.5">
        {flat.map((node) => {
          const meta = NODE_KIND_META[node.kind];
          const Icon = meta.icon;
          const isCollapsed = collapsed.has(node.id);
          const selected = selection?.kind === "node" && selection.id === node.id;
          return (
            <li key={node.id}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => onSelect(node.id)}
                onKeyDown={(e) => e.key === "Enter" && onSelect(node.id)}
                style={{ paddingLeft: `${6 + node.depth * 24}px` }}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2.5 rounded-xl py-2 pr-3 text-left transition-colors",
                  selected ? "bg-primary-soft" : "hover:bg-panel",
                )}
              >
                {node.children.length > 0 ? (
                  <span
                    role="button"
                    tabIndex={-1}
                    aria-label={isCollapsed ? "展开子节点" : "折叠子节点"}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(node.id);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && toggle(node.id)}
                    className="flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-md text-faint transition-colors hover:bg-chip hover:text-ink-2"
                  >
                    {isCollapsed ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                  </span>
                ) : (
                  <span className="size-5 shrink-0" />
                )}
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-lg",
                    meta.tone,
                  )}
                >
                  <Icon className="size-3.5" strokeWidth={1.8} />
                </span>
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-[13px]",
                    selected ? "font-semibold text-primary" : "font-medium text-ink",
                  )}
                >
                  {node.title}
                </span>
                {node.assetRefs.length > 0 && (
                  <span className="shrink-0 rounded-full bg-chip px-2 py-0.5 text-[10px] text-muted">
                    {node.assetRefs.length} 资产
                  </span>
                )}
                <span
                  className={cn(
                    "hidden shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium sm:block",
                    NODE_STATUS_META[node.status].className,
                  )}
                >
                  {NODE_STATUS_META[node.status].label}
                </span>
              </div>
              {isCollapsed && node.children.length > 0 && (
                <p
                  style={{ paddingLeft: `${34 + (node.depth + 1) * 24}px` }}
                  className="py-0.5 text-[10px] text-faint"
                >
                  已折叠 {node.children.length} 个子节点
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
