import { Search } from "lucide-react";
import type { Patent } from "@/types";
import { cn } from "@/lib/utils";

const KIND_TONES: Record<Patent["kind"], string> = {
  发明: "bg-primary-soft text-primary",
  实用新型: "bg-[#FEF3C7] text-[#B45309] dark:bg-[#3a2f10] dark:text-[#f0c94e]",
};

const STATUS_TONES: Record<Patent["status"], string> = {
  已授权: "bg-success-soft text-[#059669] dark:text-success",
  实质审查: "bg-[#FEF3C7] text-[#B45309] dark:bg-[#3a2f10] dark:text-[#f0c94e]",
  已公开: "bg-primary-soft text-primary",
  PCT: "bg-[#EDE9FE] text-[#7C3AED] dark:bg-[#2a2150] dark:text-brand-violet",
};

export type PatentSort = "latest" | "citations";

const SORTS: { key: PatentSort; label: string }[] = [
  { key: "latest", label: "最新公开" },
  { key: "citations", label: "被引最多" },
];

/** 专利表格 —— 名称 / 申请人 / 公开日(布局对齐 LibraryTable) */
export function PatentTable({
  items,
  totalCount,
  query,
  onQueryChange,
  sort,
  onSortChange,
}: {
  items: Patent[];
  totalCount: number;
  query: string;
  onQueryChange: (q: string) => void;
  sort: PatentSort;
  onSortChange: (s: PatentSort) => void;
}) {
  return (
    <div className="min-w-0 flex-1 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">专利库</h1>
          <p className="mt-1 text-xs text-faint">
            共 {totalCount} 件专利 · 上次更新 8 月 1 日
          </p>
        </div>
      </div>

      {/* 搜索 + 排序 */}
      <div className="mt-5 flex items-center gap-3">
        <div className="relative w-full max-w-[420px]">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="搜索专利名称、申请号或申请人…"
            aria-label="搜索专利"
            className="h-10 w-full rounded-xl border border-line bg-card pl-10 pr-4 text-sm text-ink outline-none transition-colors placeholder:text-faint focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/15"
          />
        </div>
        <div className="ml-auto flex gap-2">
          {SORTS.map((s) => (
            <button
              key={s.key}
              type="button"
              aria-pressed={sort === s.key}
              onClick={() => onSortChange(s.key)}
              className={cn(
                "h-9 cursor-pointer rounded-full border px-4 text-[13px] transition-colors",
                sort === s.key
                  ? "border-primary font-medium text-primary"
                  : "border-line bg-card text-muted hover:text-ink-2",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* 表头 */}
      <div className="mt-6 grid grid-cols-[minmax(0,1fr)_200px_110px] items-center gap-4 rounded-xl bg-card px-5 py-3 text-xs text-faint shadow-card">
        <span>专利名称</span>
        <span>申请人</span>
        <span>公开日</span>
      </div>

      {/* 数据行 */}
      <div className="mt-3 space-y-2">
        {items.map((patent) => (
          <div
            key={patent.id}
            className="grid cursor-pointer grid-cols-[minmax(0,1fr)_200px_110px] items-center gap-4 rounded-xl px-5 py-3 transition-colors hover:bg-card"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span
                className={cn(
                  "flex h-11 w-9 shrink-0 items-center justify-center rounded-md text-[10px] font-bold [writing-mode:vertical-lr]",
                  KIND_TONES[patent.kind],
                )}
              >
                {patent.kind}
              </span>
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-[15px] font-semibold text-ink">
                  <span className="truncate">{patent.title}</span>
                  <span
                    className={cn(
                      "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium",
                      STATUS_TONES[patent.status],
                    )}
                  >
                    {patent.status}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-faint">
                  {patent.applicationNo} · 被引 {patent.citations}
                </p>
              </div>
            </div>
            <p className="truncate text-[13px] text-muted">{patent.applicant}</p>
            <p className="text-[13px] text-muted">{patent.publishedAt}</p>
          </div>
        ))}
      </div>

      {items.length === 0 && (
        <div className="mt-3 rounded-2xl bg-card p-12 text-center text-sm text-faint shadow-card">
          未找到匹配的专利
        </div>
      )}
    </div>
  );
}
