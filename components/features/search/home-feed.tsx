"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Funnel } from "lucide-react";
import { searchPapers, type KnowledgeSearchFilters } from "@/lib/api/services";
import { KnowledgeHealthStatus } from "@/components/features/knowledge/knowledge-health-status";
import { cn } from "@/lib/utils";
import type { FeedPaper } from "@/types";
import { SearchHero } from "./search-hero";
import { FeedTabs } from "./feed-tabs";
import { FeedList } from "./feed-list";
import { PaperCard } from "./paper-card";

type SortKey = "date" | "impact" | "citations";

const SORT_ITEMS: { key: SortKey; label: string }[] = [
  { key: "date", label: "发表时间" },
  { key: "impact", label: "影响因子" },
  { key: "citations", label: "引用次数" },
];

/** 影响因子暂无真实数据,以 CCF 等级作为排序依据(A>B>C,无等级为 0) */
const CCF_RANK: Record<string, number> = { A: 3, B: 2, C: 1 };

function sortMetric(p: FeedPaper, key: SortKey): number {
  if (key === "date") return Date.parse(p.date) || 0;
  if (key === "citations") return p.citations;
  return CCF_RANK[p.ccf ?? ""] ?? 0;
}

/**
 * 排序菜单(漏斗图标):三行「发表时间 / 影响因子 / 引用次数」,
 * 每行末尾箭头表示方向——默认 ↑ 升序,点箭头切换为 ↓ 降序(再点切回);
 * 点行名选中该排序字段(新字段默认升序)。
 */
function SortMenu({
  sortKey,
  ascending,
  onSelect,
  onToggleDir,
}: {
  sortKey: SortKey;
  ascending: boolean;
  onSelect: (key: SortKey) => void;
  onToggleDir: (key: SortKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div ref={ref} className="relative ml-auto">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] transition-colors",
          open ? "bg-chip text-ink" : "text-muted hover:text-ink-2",
        )}
      >
        <Funnel className="size-4" strokeWidth={1.8} />
        排序
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-44 rounded-xl border border-line bg-card p-1.5 shadow-pop">
          {SORT_ITEMS.map((item) => {
            const active = item.key === sortKey;
            const Desc = active && !ascending;
            return (
              <div
                key={item.key}
                className={cn(
                  "flex h-9 items-center rounded-lg text-[13px] transition-colors",
                  active ? "bg-primary-soft font-medium text-primary" : "text-ink-2",
                )}
              >
                <button
                  type="button"
                  onClick={() => {
                    onSelect(item.key);
                    setOpen(false);
                  }}
                  className="flex h-full flex-1 cursor-pointer items-center px-2.5 text-left"
                >
                  {item.label}
                </button>
                <button
                  type="button"
                  aria-label={`${item.label}切换升降序`}
                  title={Desc ? "降序(点击切换升序)" : "升序(点击切换降序)"}
                  onClick={() => onToggleDir(item.key)}
                  className={cn(
                    "mr-1.5 flex size-6 cursor-pointer items-center justify-center rounded-md transition-colors",
                    active ? "text-primary hover:bg-primary/10" : "text-faint hover:bg-chip hover:text-ink-2",
                  )}
                >
                  {Desc ? (
                    <ArrowDown className="size-3.5" />
                  ) : (
                    <ArrowUp className="size-3.5" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * 发现页主体:搜索框 + Feed。
 * Alt+Enter 就地检索论文——结果以 Feed 卡片呈现,标签行
 * (推荐/前沿/关注/研究/个性化)替换为「当前检索结果如下:」+ 排序菜单。
 */
export function HomeFeed() {
  const [results, setResults] = useState<FeedPaper[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [ascending, setAscending] = useState(true);
  const [filters, setFilters] = useState<KnowledgeSearchFilters>({ topK: 10 });

  const list = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);
  const setList = (key: "conferences" | "authors" | "keywords" | "subjects", value: string) =>
    setFilters((current) => ({ ...current, [key]: list(value) }));

  const search = async (q: string) => {
    setBusy(true);
    try {
      setResults(await searchPapers(q, filters));
    } finally {
      setBusy(false);
    }
  };

  const sorted = useMemo(() => {
    if (!results) return null;
    return [...results].sort((a, b) => {
      const diff = sortMetric(a, sortKey) - sortMetric(b, sortKey);
      return ascending ? diff : -diff;
    });
  }, [results, sortKey, ascending]);

  return (
    <>
      <SearchHero onSearchPapers={search} />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 px-1">
        <details className="group rounded-xl border border-line bg-card px-3 py-2 text-sm">
          <summary className="cursor-pointer list-none text-ink-2">高级筛选 <span className="text-faint">（年份、会议、作者、关键词、主题）</span></summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <input aria-label="最早年份" type="number" placeholder="最早年份" value={filters.yearFrom ?? ""} onChange={(e) => setFilters((v) => ({ ...v, yearFrom: e.target.value ? Number(e.target.value) : undefined }))} className="rounded-lg border border-line bg-background px-2 py-1.5" />
            <input aria-label="最晚年份" type="number" placeholder="最晚年份" value={filters.yearTo ?? ""} onChange={(e) => setFilters((v) => ({ ...v, yearTo: e.target.value ? Number(e.target.value) : undefined }))} className="rounded-lg border border-line bg-background px-2 py-1.5" />
            <input aria-label="会议" placeholder="会议，如 AAAI, NeurIPS" value={(filters.conferences ?? []).join(", ")} onChange={(e) => setList("conferences", e.target.value)} className="rounded-lg border border-line bg-background px-2 py-1.5" />
            <input aria-label="作者" placeholder="作者，逗号分隔" value={(filters.authors ?? []).join(", ")} onChange={(e) => setList("authors", e.target.value)} className="rounded-lg border border-line bg-background px-2 py-1.5" />
            <input aria-label="关键词" placeholder="关键词，逗号分隔" value={(filters.keywords ?? []).join(", ")} onChange={(e) => setList("keywords", e.target.value)} className="rounded-lg border border-line bg-background px-2 py-1.5" />
            <input aria-label="主题" placeholder="主题，逗号分隔" value={(filters.subjects ?? []).join(", ")} onChange={(e) => setList("subjects", e.target.value)} className="rounded-lg border border-line bg-background px-2 py-1.5" />
            <input aria-label="结果数量" type="number" min="1" max="50" placeholder="结果数量" value={filters.topK ?? ""} onChange={(e) => setFilters((v) => ({ ...v, topK: e.target.value ? Number(e.target.value) : undefined }))} className="rounded-lg border border-line bg-background px-2 py-1.5" />
          </div>
        </details>
        <KnowledgeHealthStatus />
      </div>
      {sorted === null ? (
        <>
          <FeedTabs />
          <FeedList />
        </>
      ) : (
        <>
          <div className="flex items-center px-1">
            <span className="text-sm text-muted">
              {busy ? "正在检索论文…" : "当前检索结果如下:"}
            </span>
            <SortMenu
              sortKey={sortKey}
              ascending={ascending}
              onSelect={(key) => {
                setSortKey(key);
                if (key !== sortKey) setAscending(true);
              }}
              onToggleDir={(key) => {
                if (key !== sortKey) {
                  setSortKey(key);
                  setAscending(false);
                } else {
                  setAscending((v) => !v);
                }
              }}
            />
          </div>
          {sorted.length === 0 && !busy ? (
            <p className="px-1 py-8 text-center text-sm text-faint">
              未检索到相关论文,换个关键词试试
            </p>
          ) : (
            <div className="space-y-5">
              {sorted.map((paper, i) => (
                <PaperCard key={paper.id} paper={paper} index={i} />
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
