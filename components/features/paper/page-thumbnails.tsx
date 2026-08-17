import { cn } from "@/lib/utils";

/** 页码缩略图栏 —— 页码导航 · 1 / 18 */
export function PageThumbnails({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  return (
    <aside className="hidden w-36 shrink-0 flex-col items-center border-r border-line bg-card px-3 py-4 xl:flex">
      <p className="w-full text-center text-xs text-faint">
        页码导航 · {current} / {total}
      </p>
      <div className="mt-3 w-full space-y-3 overflow-y-auto">
        {[1, 2, 3, 4].map((page) => (
          <div key={page} className="w-full">
            <p className="mb-1 text-center text-[11px] text-faint">{page}</p>
            <div
              className={cn(
                "aspect-[3/4] w-full cursor-pointer rounded-md border bg-card transition-colors",
                page === current
                  ? "border-primary ring-1 ring-primary/30"
                  : "border-line hover:border-primary/40",
              )}
            />
          </div>
        ))}
      </div>
    </aside>
  );
}
