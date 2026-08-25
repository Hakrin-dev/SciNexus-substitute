"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Building2,
  Network,
  Search,
  Users,
} from "lucide-react";
import { useScholarGraph } from "@/lib/api/services";
import type { Scholar } from "@/types";
import { cn } from "@/lib/utils";

/** 图谱画布尺寸(viewBox) */
const VIEW_W = 740;
const VIEW_H = 540;

/** 力导向布局:共享方向作为弹簧引力,方向相近的学者自然聚拢(确定性迭代,无随机) */
function computePositions(scholars: Scholar[], edges: { source: string; target: string; strength: number }[]) {
  const n = scholars.length;
  if (n === 0) return {} as Record<string, { x: number; y: number }>;

  const pos = new Map<string, { x: number; y: number }>();
  const vel = new Map<string, { x: number; y: number }>();
  const index = new Map<string, number>();

  // 初始位置:均匀分布在圆环上(确定性)
  scholars.forEach((s, i) => {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    const r = Math.min(VIEW_W, VIEW_H) * 0.3;
    pos.set(s.id, { x: VIEW_W / 2 + r * Math.cos(angle), y: VIEW_H / 2 + r * Math.sin(angle) });
    vel.set(s.id, { x: 0, y: 0 });
    index.set(s.id, i);
  });

  // 斥力:同方向共享标签越多,斥力越小(避免完全重叠);基础斥力保证间距
  // 引力:共享方向的学者互相吸引,强度 = 共享方向数
  const REPULSION = 4200;
  const ATTRACTION_BASE = 0.06;
  const ATTRACTION_PER_SHARED = 0.03;
  const CENTER = 0.02;
  const DAMPING = 0.82;
  const ITERATIONS = 90;

  for (let iter = 0; iter < ITERATIONS; iter++) {
    // 斥力(所有节点对)
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = scholars[i];
        const b = scholars[j];
        const pa = pos.get(a.id)!;
        const pb = pos.get(b.id)!;
        let dx = pa.x - pb.x;
        let dy = pa.y - pb.y;
        const distSq = dx * dx + dy * dy || 1;
        const dist = Math.sqrt(distSq);
        const sharedCount = a.tags.filter((t) => b.tags.includes(t)).length;
        const force = REPULSION / distSq / (1 + sharedCount);
        dx = (dx / dist) * force;
        dy = (dy / dist) * force;
        const va = vel.get(a.id)!;
        const vb = vel.get(b.id)!;
        va.x += dx;
        va.y += dy;
        vb.x -= dx;
        vb.y -= dy;
      }
    }
    // 引力(共享方向)
    for (const edge of edges) {
      const pa = pos.get(edge.source)!;
      const pb = pos.get(edge.target)!;
      let dx = pb.x - pa.x;
      let dy = pb.y - pa.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = (ATTRACTION_BASE + ATTRACTION_PER_SHARED * edge.strength) * dist;
      dx = (dx / dist) * force;
      dy = (dy / dist) * force;
      const va = vel.get(edge.source)!;
      const vb = vel.get(edge.target)!;
      va.x += dx;
      va.y += dy;
      vb.x -= dx;
      vb.y -= dy;
    }
    // 中心引力(防止整体漂移)
    for (const s of scholars) {
      const p = pos.get(s.id)!;
      const v = vel.get(s.id)!;
      v.x += (VIEW_W / 2 - p.x) * CENTER;
      v.y += (VIEW_H / 2 - p.y) * CENTER;
    }
    // 速度阻尼 + 位置更新
    for (const s of scholars) {
      const p = pos.get(s.id)!;
      const v = vel.get(s.id)!;
      v.x *= DAMPING;
      v.y *= DAMPING;
      p.x += v.x;
      p.y += v.y;
    }
  }

  // 归一化到画布内并留边距
  const points = scholars.map((s) => pos.get(s.id)!);
  const minX = Math.min(...points.map((p) => p.x));
  const maxX = Math.max(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const maxY = Math.max(...points.map((p) => p.y));
  const pad = 90;
  const scaleX = (VIEW_W - pad * 2) / (maxX - minX || 1);
  const scaleY = (VIEW_H - pad * 2) / (maxY - minY || 1);
  const scale = Math.min(scaleX, scaleY);
  const offsetX = VIEW_W / 2 - ((minX + maxX) / 2) * scale;
  const offsetY = VIEW_H / 2 - ((minY + maxY) / 2) * scale;

  const result: Record<string, { x: number; y: number }> = {};
  for (const s of scholars) {
    const p = pos.get(s.id)!;
    result[s.id] = { x: p.x * scale + offsetX, y: p.y * scale + offsetY };
  }
  return result;
}

export function ScholarNetwork() {
  const [selectedId, setSelectedId] = useState("kaiming-he");
  const [direction, setDirection] = useState("全部");
  const [query, setQuery] = useState("");
  // 节点/边/方向均来自后端 /api/scholars/graph（后端按共享研究方向构图）
  const { data: graph } = useScholarGraph();
  const scholars = graph?.nodes ?? [];
  const edges = graph?.edges ?? [];
  const directionOptions = graph?.directions ?? [];

  // 位置:力导向布局(随学者集合变化)
  const positions = useMemo(() => computePositions(scholars, edges), [scholars, edges]);

  const selected = scholars.find((scholar) => scholar.id === selectedId) ?? scholars[0];
  const visibleIds = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return new Set(
      scholars
        .filter((scholar) => direction === "全部" || scholar.tags.includes(direction))
        .filter((scholar) => !keyword || `${scholar.nameCn} ${scholar.nameEn} ${scholar.affiliation}`.toLowerCase().includes(keyword))
        .map((scholar) => scholar.id),
    );
  }, [direction, query, scholars]);

  const connected = edges.filter((edge) => edge.source === selected.id || edge.target === selected.id);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex flex-wrap items-center gap-4 border-b border-line bg-card px-6 py-4 lg:px-8">
        <Link href="/knowledge/scholars" className="flex size-9 items-center justify-center rounded-lg border border-line text-muted hover:bg-chip hover:text-primary">
          <ArrowLeft className="size-4" />
        </Link>
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft"><Network className="size-5 text-primary" /></span>
        <div>
          <h1 className="text-lg font-bold text-ink">学者研究方向网络</h1>
          <p className="text-xs text-faint">按共享研究方向连线,方向相近的学者自然聚拢</p>
        </div>
        <div className="ml-auto flex gap-2 text-xs">
          <span className="rounded-full bg-panel px-3 py-1.5 text-muted"><b className="text-ink">{scholars.length}</b> 位学者</span>
          <span className="rounded-full bg-panel px-3 py-1.5 text-muted"><b className="text-ink">{edges.length}</b> 条研究方向关联</span>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[230px_minmax(0,1fr)_300px]">
        <aside className="border-r border-line bg-card p-5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索学者…" className="h-10 w-full rounded-xl border border-line bg-panel pl-9 pr-3 text-xs text-ink outline-none placeholder:text-faint focus:border-primary/50" />
          </div>
          <p className="mt-6 text-[11px] font-medium tracking-wide text-faint">研究方向</p>
          <div className="mt-2 space-y-1">
            {["全部", ...directionOptions].map((item) => (
              <button key={item} type="button" onClick={() => setDirection(item)} className={cn("flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs", direction === item ? "bg-primary-soft font-medium text-primary" : "text-muted hover:bg-panel")}>
                {item}<span>{item === "全部" ? scholars.length : scholars.filter((scholar) => scholar.tags.includes(item)).length}</span>
              </button>
            ))}
          </div>
        </aside>

        <main className="relative min-h-[620px] overflow-hidden bg-[radial-gradient(circle_at_center,var(--color-card)_0,var(--color-background)_68%)] p-5">
          <div className="absolute left-5 top-5 z-10 rounded-xl bg-card/90 px-4 py-3 shadow-card backdrop-blur">
            <p className="text-xs font-semibold text-ink">共享研究方向连线 · 力导向布局</p>
            <p className="mt-0.5 text-[10px] text-faint">点击节点探索关系</p>
          </div>
          <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="h-full min-h-[580px] w-full" aria-label="学者研究方向关系图">
            <defs>
              <filter id="node-shadow"><feDropShadow dx="0" dy="4" stdDeviation="5" floodOpacity="0.14" /></filter>
            </defs>
            {edges.map((edge) => {
              const source = positions[edge.source];
              const target = positions[edge.target];
              if (!source || !target) return null;
              const visible = visibleIds.has(edge.source) && visibleIds.has(edge.target);
              const active = edge.source === selected.id || edge.target === selected.id;
              return (
                <g key={`${edge.source}-${edge.target}`} className={visible ? "opacity-100" : "opacity-10"}>
                  <line x1={source.x} y1={source.y} x2={target.x} y2={target.y} stroke={active ? "var(--color-primary)" : "var(--color-line)"} strokeWidth={active ? 2 + edge.strength : Math.max(1.5, 2 + edge.strength * 0.8)} />
                  {active && <text x={(source.x + target.x) / 2} y={(source.y + target.y) / 2 - 7} textAnchor="middle" fill="var(--color-muted)" fontSize="10">{edge.label}</text>}
                </g>
              );
            })}
            {scholars.map((scholar) => {
              const position = positions[scholar.id];
              if (!position) return null;
              const visible = visibleIds.has(scholar.id);
              const active = scholar.id === selected.id;
              return (
                <g key={scholar.id} onClick={() => visible && setSelectedId(scholar.id)} className={cn("cursor-pointer outline-none transition-opacity", visible ? "opacity-100" : "pointer-events-none opacity-15")} role="button" tabIndex={visible ? 0 : -1}>
                  {active && <circle cx={position.x} cy={position.y} r="48" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeDasharray="5 5" opacity="0.45" />}
                  <circle cx={position.x} cy={position.y} r={active ? 35 : 30} fill={scholar.avatarColor} stroke="var(--color-card)" strokeWidth="5" filter="url(#node-shadow)" />
                  <text x={position.x} y={position.y + 5} textAnchor="middle" fill="white" fontSize="14" fontWeight="700">{scholar.initials}</text>
                  <text x={position.x} y={position.y + 51} textAnchor="middle" fill="var(--color-ink)" fontSize="12" fontWeight="600">{scholar.nameCn}</text>
                  <text x={position.x} y={position.y + 67} textAnchor="middle" fill="var(--color-faint)" fontSize="9">h-index {scholar.hIndex}</text>
                </g>
              );
            })}
          </svg>
        </main>

        <aside className="border-l border-line bg-card p-5">
          <div className="flex items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-full text-sm font-bold text-white" style={{ backgroundColor: selected.avatarColor }}>{selected.initials}</span>
            <div className="min-w-0"><h2 className="truncate text-sm font-bold text-ink">{selected.nameCn}</h2><p className="truncate text-xs text-faint">{selected.nameEn}</p></div>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-muted">{selected.bio}</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-panel p-3"><p className="text-lg font-bold text-ink">{selected.citations}</p><p className="text-[10px] text-faint">总引用</p></div>
            <div className="rounded-xl bg-panel p-3"><p className="text-lg font-bold text-ink">{selected.hIndex}</p><p className="text-[10px] text-faint">h-index</p></div>
          </div>
          <div className="mt-5 space-y-3 text-xs">
            <p className="flex items-start gap-2 text-muted"><Building2 className="mt-0.5 size-4 shrink-0 text-faint" />{selected.affiliation}</p>
            <p className="flex items-center gap-2 text-muted"><Users className="size-4 text-faint" />{connected.length} 条研究方向关联</p>
            <p className="flex items-center gap-2 text-muted"><BookOpen className="size-4 text-faint" />研究方向：{selected.tags.slice(0, 2).join("、")}</p>
          </div>
          <div className="mt-5 flex flex-wrap gap-1.5">{selected.tags.map((tag) => <span key={tag} className="rounded-md bg-chip px-2 py-1 text-[10px] text-muted">{tag}</span>)}</div>
          <Link href={`/scholars/${selected.id}`} className="mt-6 flex h-10 w-full items-center justify-center rounded-xl bg-primary text-xs font-medium text-white hover:bg-primary/90">查看完整学者画像</Link>
          <div className="mt-6 border-t border-line pt-4">
            <p className="text-[11px] font-semibold text-ink-2">共享研究方向</p>
            <div className="mt-2 space-y-2">
              {connected.length === 0 && <p className="text-[11px] text-faint">未与当前筛选下的学者共享方向</p>}
              {connected.map((edge) => {
                const otherId = edge.source === selected.id ? edge.target : edge.source;
                const other = scholars.find((scholar) => scholar.id === otherId)!;
                return <button key={otherId} type="button" onClick={() => setSelectedId(otherId)} className="flex w-full items-center gap-2 rounded-lg bg-panel px-2.5 py-2 text-left hover:bg-chip"><span className="size-2 rounded-full" style={{ backgroundColor: other.avatarColor }} /><span className="flex-1 truncate text-[11px] text-ink-2">{other.nameCn}</span><span className="text-[9px] text-faint">{edge.label}</span></button>;
              })}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}