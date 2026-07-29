import { cn } from "@/lib/utils";

/** 年度引用柱状图 —— 纯 CSS 实现(对应学者详情页 SVG 红色柱状图) */
export function CitationChart({
  years,
  values,
  highlight,
}: {
  years: string[];
  values: number[];
  highlight: string;
}) {
  const max = Math.max(...values);

  return (
    <section className="rounded-2xl bg-card p-5 shadow-card">
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-semibold text-ink">年度引用</h3>
        <span className="text-xs font-medium text-[#B91C1C] dark:text-[#f87171]">
          {highlight}
        </span>
      </div>
      <div className="mt-4 flex h-24 items-end gap-1.5">
        {values.map((value, i) => (
          <div
            key={years[i]}
            title={`${years[i]}: ${value.toLocaleString()}`}
            className={cn(
              "flex-1 rounded-t-sm bg-[#B91C1C] transition-opacity hover:opacity-80 dark:bg-[#f87171]",
              i < 2 && "opacity-40",
              i >= 2 && i < 5 && "opacity-60",
            )}
            style={{ height: `${Math.max(8, (value / max) * 100)}%` }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-faint">
        <span>{years[0]}</span>
        <span>{years[years.length - 1]}</span>
      </div>
    </section>
  );
}
