"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, ChevronDown, Database, FolderKanban, FolderOpen, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { ASSET_KIND_META, ASSET_STATUS_META } from "./workbench-meta";
import { formatDay } from "@/lib/data/workbench";
import type { AssetKind, Selection, WorkbenchAsset } from "@/lib/data/workbench";

interface Props {
  projectId: string;
  projectName: string;
  assets: WorkbenchAsset[];
  selection: Selection;
  onSelect: (assetId: string) => void;
}

const KIND_FILTERS: { value: AssetKind | "all"; label: string }[] = [
  { value: "all", label: "全部类型" },
  { value: "paper", label: "文献" },
  { value: "dataset", label: "数据" },
  { value: "note", label: "笔记" },
  { value: "experiment", label: "实验" },
];

const STAGE_FOLDERS = [
  ["plan", "01 研究计划"], ["search", "02 文献检索"], ["read", "03 结构化阅读"],
  ["synthesize", "04 证据综合"], ["design", "05 实验设计"], ["code", "06 实验代码"],
  ["run", "07 实验结果"], ["report", "08 研究报告"], ["manual", "手工资料"],
] as const;

/** 资产视图 —— 多维表格:搜索 + 类型筛选 + 行选中联动右栏 */
export function AssetTableView({ projectId, projectName, assets, selection, onSelect }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<AssetKind | "all">("all");
  const [collapsed, setCollapsed] = useState<Set<string>>(
    () => new Set(["plan", "search", "read", "synthesize", "design", "code", "run"]),
  );

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return [...assets]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .filter((asset) => {
        if (kind !== "all" && asset.kind !== kind) return false;
        return (
          !keyword ||
          `${asset.title} ${asset.meta} ${asset.tags.join(" ")}`.toLowerCase().includes(keyword)
        );
      });
  }, [assets, query, kind]);
  const folders = useMemo(() => STAGE_FOLDERS.map(([key, label]) => ({
    key, label, items: filtered.filter((asset) => {
      const inferred = asset.kind === "paper" ? (asset.status === "unread" ? "search" : "read") : asset.kind === "dataset" ? "run" : asset.kind === "experiment" ? "run" : asset.kind === "note" ? "synthesize" : "manual";
      const stage = String(asset.artifact?.metadata?.stage || asset.tags.find((tag) => STAGE_FOLDERS.some(([candidate]) => candidate === tag)) || inferred);
      return stage === key;
    }),
  })).filter((folder) => folder.items.length > 0), [filtered]);

  return (
    <section className="rounded-2xl bg-card p-6 shadow-card">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-violet/10 text-brand-violet">
            <Database className="size-5" strokeWidth={1.8} />
          </span>
          <div>
            <h2 className="text-[15px] font-bold text-ink">资产库</h2>
            <p className="mt-0.5 text-xs text-muted">{assets.length} 个产物 · 按自动研究流程归档</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" strokeWidth={1.8} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索标题、标签…"
              className="h-9 w-56 rounded-xl border border-line bg-panel pl-9 pr-3 text-sm text-ink outline-none placeholder:text-faint focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/15"
            />
          </div>
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value as AssetKind | "all")}
            className="h-9 rounded-xl border border-line bg-panel px-3 text-xs text-ink-2 outline-none"
          >
            {KIND_FILTERS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      <div className="mt-5 rounded-2xl border border-primary/20 bg-primary-soft/20 p-3">
        <div className="mb-3 flex items-center gap-3 rounded-xl bg-card px-4 py-3 shadow-sm"><span className="flex size-9 items-center justify-center rounded-lg bg-primary text-white"><FolderKanban className="size-4" /></span><div><p className="text-xs font-bold text-ink">{projectName}</p><p className="mt-0.5 text-[10px] text-muted">项目资产 · {assets.length} 个产物 · {folders.length} 个流程目录</p></div></div>
      <div className="space-y-2 pl-3 sm:pl-6">
        {folders.map((folder) => <section key={folder.key} className="overflow-hidden rounded-xl border border-line">
          <button onClick={() => setCollapsed((current) => { const next = new Set(current); if (next.has(folder.key)) next.delete(folder.key); else next.add(folder.key); return next; })} className="flex w-full items-center gap-2 bg-panel px-4 py-3 text-left">
            <FolderOpen className="size-4 text-primary" /><span className="text-xs font-semibold text-ink">{folder.label}</span><span className="rounded-full bg-card px-2 py-0.5 text-[10px] text-muted">{folder.items.length}</span><ChevronDown className={cn("ml-auto size-4 text-faint transition-transform", collapsed.has(folder.key) && "-rotate-90")} />
          </button>
          {!collapsed.has(folder.key) && <><div className="grid grid-cols-[minmax(0,1fr)_76px_92px_84px_88px] items-center gap-3 border-y border-line px-4 py-2 text-[10px] font-medium text-faint"><span>产物</span><span>类型</span><span>问题 / 假设</span><span>状态</span><span>更新时间</span></div><ul className="divide-y divide-line/60">
        {folder.items.map((asset) => {
          const meta = ASSET_KIND_META[asset.kind];
          const Icon = meta.icon;
          const selected = selection?.kind === "asset" && selection.id === asset.id;
          return (
            <li
              key={asset.id}
              role="button"
              tabIndex={0}
              onClick={() => {
                onSelect(asset.id);
                router.push(`/projects/${projectId}/assets/${encodeURIComponent(asset.id)}`);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onSelect(asset.id);
                  router.push(`/projects/${projectId}/assets/${encodeURIComponent(asset.id)}`);
                }
              }}
              className={cn(
                "grid cursor-pointer grid-cols-[minmax(0,1fr)_76px_92px_84px_88px] items-center gap-3 rounded-xl px-4 py-3 transition-colors",
                selected ? "bg-primary-soft" : "hover:bg-panel/70",
              )}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", meta.tone)}>
                  <Icon className="size-4" strokeWidth={1.8} />
                </span>
                <div className="min-w-0">
                  <p
                    className={cn(
                      "truncate text-[13px] font-medium",
                      selected ? "text-primary" : "text-ink",
                    )}
                  >
                    {asset.title}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-faint">
                    {asset.meta} · {asset.tags.join(" / ")}
                  </p>
                </div>
              </div>
              <span className="text-xs text-muted">{meta.label}</span>
              <span className="truncate text-xs text-muted">
                {[...asset.questionIds, ...asset.hypothesisIds].map((id) => id.toUpperCase()).join(" ") || "—"}
              </span>
              <span
                className={cn(
                  "w-fit rounded-full px-2 py-0.5 text-[10px] font-medium",
                  ASSET_STATUS_META[asset.status].className,
                )}
              >
                {ASSET_STATUS_META[asset.status].label}
              </span>
              <span className="flex items-center gap-1 text-xs text-faint">
                {formatDay(asset.updatedAt)} <ArrowUpRight className="size-3" />
              </span>
            </li>
          );
        })}
          </ul></>}
        </section>)}
      </div></div>

      {filtered.length === 0 && (
        <div className="mt-2 rounded-xl bg-panel p-10 text-center text-sm text-faint">
          未找到匹配的资产
        </div>
      )}
    </section>
  );
}
