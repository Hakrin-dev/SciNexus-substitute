import { Search } from "lucide-react";
import type { Funding } from "@/types";
import { cn } from "@/lib/utils";

const STATUS_TONES: Record<Funding["status"], string> = {
  在研: "bg-success-soft text-[#059669] dark:text-success",
  结题: "bg-chip text-muted",
};

/** 基金表格 —— 项目名称 / 负责人·依托单位 / 资助金额 / 起止年限 */
export function FundingTable({
  items,
  totalCount,
  query,
  onQueryChange,
}: {
  items: Funding[];
  totalCount: number;
  query: string;
  onQueryChange: (q: string) => void;
}) {
  return (
    <div className="min-w-0 flex-1 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">项目基金库</h1>
          <p className="mt-1 text-xs text-faint">
            共 {totalCount} 个项目 · 上次更新 8 月 1 日
          </p>
        </div>
      </div>

      {/* 搜索 */}
      <div className="mt-5">
        <div className="relative w-full max-w-[420px]">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="搜索项目名称、批准号、负责人或依托单位…"
            aria-label="搜索项目基金"
            className="h-10 w-full rounded-xl border border-line bg-card pl-10 pr-4 text-sm text-ink outline-none transition-colors placeholder:text-faint focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/15"
          />
        </div>
      </div>

      {/* 表头 */}
      <div className="mt-6 grid grid-cols-[minmax(0,1fr)_220px_110px_150px] items-center gap-4 rounded-xl bg-card px-5 py-3 text-xs text-faint shadow-card">
        <span>项目名称</span>
        <span>负责人 · 依托单位</span>
        <span>资助金额</span>
        <span>起止年限</span>
      </div>

      {/* 数据行 */}
      <div className="mt-3 space-y-2">
        {items.map((funding) => (
          <div
            key={funding.id}
            className="grid cursor-pointer grid-cols-[minmax(0,1fr)_220px_110px_150px] items-center gap-4 rounded-xl px-5 py-3 transition-colors hover:bg-card"
          >
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-[15px] font-semibold text-ink">
                <span className="truncate">{funding.title}</span>
                <span
                  className={cn(
                    "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium",
                    STATUS_TONES[funding.status],
                  )}
                >
                  {funding.status}
                </span>
              </p>
              <p className="mt-0.5 text-xs text-faint">
                批准号 {funding.grantNo} · {funding.category}
              </p>
            </div>
            <p className="truncate text-[13px] text-muted">
              {funding.pi} · {funding.institution}
            </p>
            <p className="text-[13px] font-medium text-ink-2">{funding.amount}</p>
            <p className="text-[13px] text-muted">{funding.period}</p>
          </div>
        ))}
      </div>

      {items.length === 0 && (
        <div className="mt-3 rounded-2xl bg-card p-12 text-center text-sm text-faint shadow-card">
          未找到匹配的项目
        </div>
      )}
    </div>
  );
}
