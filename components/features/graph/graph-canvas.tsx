"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { GraphNode, PaperGraph } from "@/types";
import { VIEW_H, VIEW_W, type PlacedNode } from "@/lib/graph-layout";

interface GraphCanvasProps {
  graph: PaperGraph;
  layout: Map<string, PlacedNode>;
  variant: "concentric" | "strata";
  selectedId: string;
  onSelect: (id: string) => void;
}

/** 私域层带标注位置(y 与 strataLayout 的带高对应) */
const BAND_META = [
  { layer: "mine" as const, text: "我的发表", y: 96 },
  { layer: "folder" as const, text: "收藏论文", y: 476 },
];

/** 知识图谱画布 —— 边 → 层带标注 → 节点 → 图例;点击空白回到 origin */
export function GraphCanvas({
  graph,
  layout,
  variant,
  selectedId,
  onSelect,
}: GraphCanvasProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const allNodes: GraphNode[] = [graph.origin, ...graph.nodes];
  const focusId = hoveredId ?? selectedId;

  const neighbors = new Set(
    graph.edges.flatMap((e) =>
      e.source === focusId
        ? [e.target]
        : e.target === focusId
          ? [e.source]
          : [],
    ),
  );

  const nodeFill = (node: GraphNode) =>
    variant === "strata" && node.layer === "folder"
      ? "var(--color-brand-blue)"
      : "var(--color-primary)";

  return (
    <div>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="h-auto w-full select-none"
        role="img"
        aria-label="知识图谱"
        onClick={() => onSelect(graph.origin.id)}
      >
        {/* 边 */}
        {graph.edges.map((edge) => {
          const a = layout.get(edge.source);
          const b = layout.get(edge.target);
          if (!a || !b) return null;
          const active = edge.source === focusId || edge.target === focusId;
          return (
            <line
              key={`${edge.source}-${edge.target}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={active ? "var(--color-primary)" : "var(--color-line)"}
              strokeWidth={(1 + edge.strength * 1.5) * (active ? 1.4 : 1)}
              strokeDasharray={edge.crossLayer ? "5 4" : undefined}
              opacity={hoveredId && !active ? 0.25 : 0.9}
            />
          );
        })}

        {/* 私域:分层虚线 + 层带标注 */}
        {variant === "strata" && (
          <>
            <line
              x1={24}
              y1={VIEW_H / 2 - 40}
              x2={VIEW_W - 24}
              y2={VIEW_H / 2 - 40}
              stroke="var(--color-line)"
              strokeDasharray="3 6"
            />
            {BAND_META.map((band) => (
              <text
                key={band.layer}
                x={24}
                y={band.y}
                fontSize={13}
                letterSpacing={2}
                className="fill-faint"
              >
                {band.text} ·{" "}
                {allNodes.filter((n) => n.layer === band.layer).length}
              </text>
            ))}
          </>
        )}

        {/* 节点 */}
        {allNodes.map((node, i) => {
          const p = layout.get(node.id);
          if (!p) return null;
          const selected = node.id === selectedId;
          const dimmed =
            hoveredId !== null &&
            node.id !== focusId &&
            !neighbors.has(node.id);
          return (
            <motion.g
              key={node.id}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: dimmed ? 0.3 : 1, scale: 1 }}
              transition={{ delay: i * 0.04, duration: 0.35 }}
              style={{
                transformBox: "fill-box",
                transformOrigin: "center",
                cursor: "pointer",
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(node.id);
              }}
              onMouseEnter={() => setHoveredId(node.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <circle
                cx={p.x}
                cy={p.y}
                r={p.r}
                fill={nodeFill(node)}
                fillOpacity={selected ? 1 : 0.55 + node.weight * 0.45}
                stroke={
                  selected ? "var(--color-brand-violet)" : "var(--color-card)"
                }
                strokeWidth={selected ? 3 : 2}
              />
              <text
                x={p.x}
                y={p.y + p.r + 17}
                textAnchor="middle"
                fontSize={12}
                fontWeight={600}
                className="fill-ink-2"
              >
                {node.labelLines[0]}
              </text>
              <text
                x={p.x}
                y={p.y + p.r + 33}
                textAnchor="middle"
                fontSize={11}
                className="fill-faint"
              >
                {node.labelLines[1]}
              </text>
            </motion.g>
          );
        })}
      </svg>

      {/* 图例 */}
      <div className="mt-2 flex items-center justify-center gap-5 text-xs text-faint">
        {variant === "strata" ? (
          <>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-primary" />
              我的发表
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-brand-blue" />
              收藏论文
            </span>
            <span>虚线 = 跨层关联</span>
          </>
        ) : (
          <span>圆圈大小 = 与原文关系强度</span>
        )}
      </div>
    </div>
  );
}
