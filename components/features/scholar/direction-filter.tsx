import { scholarDirections } from "@/lib/data/scholars";

/** 研究方向筛选 —— 学者画像页左侧栏 */
export function DirectionFilter() {
  return (
    <aside className="w-48 shrink-0">
      <p className="px-2 text-[13px] text-faint">研究方向</p>
      <ul className="mt-3 space-y-1">
        {scholarDirections.map((dir, i) => (
          <li key={dir.name}>
            <button
              type="button"
              className={
                "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-card " +
                (i === 0 ? "font-medium text-ink" : "text-ink-2")
              }
            >
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: dir.color }}
              />
              <span className="flex-1">{dir.name}</span>
              <span className="text-xs text-faint">{dir.count}</span>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
