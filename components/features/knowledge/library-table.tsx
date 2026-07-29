import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { libraryItems } from "@/lib/data/library";
import { cn } from "@/lib/utils";

const PDF_TONES = {
  violet: "bg-primary-soft text-primary",
  amber: "bg-[#FEF3C7] text-[#B45309] dark:bg-[#3a2f10] dark:text-[#f0c94e]",
  green: "bg-success-soft text-[#059669] dark:text-success",
} as const;

/** 在读文献表格 —— 标题 / 作者 / 添加时间 */
export function LibraryTable() {
  return (
    <div className="min-w-0 flex-1 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">在读</h1>
          <p className="mt-1 text-xs text-faint">
            12 篇文献 · 上次更新 7 月 25 日
          </p>
        </div>
        <Button className="rounded-xl">
          <Upload className="size-4" />
          上传私有论文
        </Button>
      </div>

      {/* 表头 */}
      <div className="mt-6 grid grid-cols-[minmax(0,1fr)_220px_90px] items-center gap-4 rounded-xl bg-card px-5 py-3 text-xs text-faint shadow-card">
        <span className="flex items-center gap-3">
          <span className="size-4 rounded border border-line" />
          标题
        </span>
        <span>作者</span>
        <span>添加时间</span>
      </div>

      {/* 数据行 */}
      <div className="mt-3 space-y-2">
        {libraryItems.map((item) => (
          <div
            key={item.id}
            className="grid cursor-pointer grid-cols-[minmax(0,1fr)_220px_90px] items-center gap-4 rounded-xl px-5 py-3 transition-colors hover:bg-card"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="size-4 shrink-0 rounded border border-line bg-card" />
              <span
                className={cn(
                  "flex h-11 w-9 shrink-0 items-end justify-center rounded-md pb-1 text-[10px] font-bold",
                  PDF_TONES[item.pdfTone],
                )}
              >
                PDF
              </span>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold text-ink">
                  {item.title}
                </p>
                <p className="mt-0.5 text-xs text-faint">
                  {item.venue} · {item.arxiv}
                </p>
              </div>
            </div>
            <p className="truncate text-[13px] text-muted">{item.authors}</p>
            <p className="text-[13px] text-muted">{item.addedAt}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
