"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
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
  const flat = useMemo(() => flattenOutline(nodes), [nodes]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section className="rounded-2xl bg-card p-5 shadow-card">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">研究大纲</h2>
          <p className="mt-0.5 text-xs text-faint">
            问题 → 假设 → 证据 → 结论 · 点击节点查看右栏详情
          </p>
        </div>
        <button
          onClick={() => setCollapsed(new Set(flat.filter((n) => n.children.length > 0).map((n) => n.id)))}
          className="cursor-pointer rounded-lg px-2.5 py-1.5 text-xs text-muted transition-colors hover:bg-chip"
        >
          全部折叠
        </button>
      </header>

      <ul className="mt-4 space-y-1">
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
                style={{ paddingLeft: `${8 + node.depth * 20}px` }}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2 rounded-xl py-2 pr-3 text-left transition-colors hover:bg-chip",
                  selected && "bg-primary-soft",
                )}
              >
                {node.children.length > 0 ? (
                  <span
                    role="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(node.id);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && toggle(node.id)}
                    className="shrink-0 cursor-pointer text-faint"
                  >
                    {isCollapsed ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                  </span>
                ) : (
                  <span className="size-3.5 shrink-0" />
                )}
                <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-md", meta.tone)}>
                  <Icon className="size-3.5" />
                </span>
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-sm",
                    selected ? "font-semibold text-primary" : "text-ink",
                  )}
                >
                  {node.title}
                </span>
                {node.assetRefs.length > 0 && (
                  <span className="shrink-0 rounded-full bg-chip px-2 py-0.5 text-[11px] text-muted">
                    {node.assetRefs.length} 资产
                  </span>
                )}
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                    NODE_STATUS_META[node.status].className,
                  )}
                >
                  {NODE_STATUS_META[node.status].label}
                </span>
              </div>
              {isCollapsed &&
                renderCollapsedHint(node.children, node.depth + 1)}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function renderCollapsedHint(children: OutlineNode[], depth: number) {
  if (children.length === 0) return null;
  return (
    <p
      style={{ paddingLeft: `${28 + depth * 20}px` }}
      className="py-0.5 text-[11px] text-faint"
    >
      已折叠 {children.length} 个子节点
    </p>
  );
}
