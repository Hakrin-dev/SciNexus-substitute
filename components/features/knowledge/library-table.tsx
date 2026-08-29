"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Network, Search, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLibraryItems } from "@/lib/api/services";
import { useUserPreferences } from "@/stores/user-preferences";
import { cn } from "@/lib/utils";
import { libraryFolders, libraryTags } from "@/lib/data/library";

const PDF_TONES = {
  violet: "bg-primary-soft text-primary",
  amber: "bg-brand-blue-soft text-brand-blue",
  green: "bg-success-soft text-success",
} as const;

/** 默认文件夹:与侧边栏 PaperSubNav、LibraryPanel 对齐 */
const DEFAULT_FOLDER = "在读";

/** 生成切换 ?tag= 的 URL（保留当前 ?folder=） */
function buildTagHref(searchParams: URLSearchParams, nextTag: string | null) {
  const params = new URLSearchParams(Array.from(searchParams.entries()));
  if (nextTag) {
    params.set("tag", nextTag);
  } else {
    params.delete("tag");
  }
  const qs = params.toString();
  return qs ? `/knowledge/papers?${qs}` : "/knowledge/papers";
}

/** 论文库表格 —— 过滤条件：
 *  ?folder=  文件夹名（侧边栏写入，缺省=「在读」）
 *  ?tag=     标签名（右侧「标签」筛选 chips 写入，空=不筛选标签）
 *  其余搜索 / 会议 / 年份筛选仍用本地 state。
 */
export function LibraryTable() {
  const [query, setQuery] = useState("");
  const [venue, setVenue] = useState("全部会议");
  const [year, setYear] = useState("全部年份");
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileInput = useRef<HTMLInputElement>(null);
  const { data: libraryItems = [] } = useLibraryItems();
  const bookmarkedPapers = useUserPreferences((s) => s.bookmarkedPapers);

  const folderName = searchParams.get("folder") || DEFAULT_FOLDER;
  const tagName = searchParams.get("tag");
  const lastUpdated = libraryItems.find((it) => (it.folder ?? DEFAULT_FOLDER) === folderName)?.addedAt;
  const folderCount = libraryFolders.find((f) => f.name === folderName)?.count ?? 0;

  const venues = ["全部会议", ...new Set(libraryItems.map((item) => item.venue.split(" ")[0]))];
  const years = ["全部年份", ...new Set(libraryItems.map((item) => item.venue.match(/\d{4}/)?.[0] ?? "其他"))];

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return libraryItems.filter((item) => {
      if ((item.folder ?? DEFAULT_FOLDER) !== folderName) return false;
      if (tagName && !(item.tags ?? []).includes(tagName)) return false;
      const itemVenue = item.venue.split(" ")[0];
      const itemYear = item.venue.match(/\d{4}/)?.[0] ?? "其他";
      if (venue !== "全部会议" && itemVenue !== venue) return false;
      if (year !== "全部年份" && itemYear !== year) return false;
      return !keyword || `${item.title} ${item.authors} ${item.venue} ${item.arxiv} ${(item.tags ?? []).join(" ")}`.toLowerCase().includes(keyword);
    });
  }, [query, venue, year, folderName, tagName, libraryItems]);

  const heading = folderName;

  return (
    <div className="min-h-[calc(100vh)] w-full min-w-0 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">
            {heading}
            {tagName && (
              <span className="ml-2 inline-flex items-center rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-medium text-primary">
                # {tagName}
              </span>
            )}
          </h1>
          <p className="mt-1 text-xs text-faint">
            {folderCount} 篇文献{lastUpdated ? ` · 上次更新 ${lastUpdated}` : ""}
          </p>
        </div>
        <Button className="rounded-xl" onClick={() => fileInput.current?.click()}>
          <Upload className="size-4" />
          上传私有论文
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) router.push("/knowledge/reader");
          }}
        />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[280px] max-w-[460px] flex-1">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索标题、作者、会议或 arXiv 编号…"
            className="h-10 w-full rounded-xl border border-line bg-card pl-10 pr-4 text-sm text-ink outline-none placeholder:text-faint focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/15"
          />
        </div>
        <select value={venue} onChange={(event) => setVenue(event.target.value)} className="h-10 rounded-xl border border-line bg-card px-3 text-xs text-ink-2 outline-none">
          {venues.map((item) => <option key={item}>{item}</option>)}
        </select>
        <select value={year} onChange={(event) => setYear(event.target.value)} className="h-10 rounded-xl border border-line bg-card px-3 text-xs text-ink-2 outline-none">
          {years.map((item) => <option key={item}>{item}</option>)}
        </select>
        <span className="text-xs text-faint">找到 {filtered.length} 篇</span>
      </div>

      {/* 标签 + 图谱入口 —— 从最左侧侧边栏迁移至此，成为主内容区的筛选模块 */}
      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-card p-3 shadow-card">
          <p className="px-1 text-[12px] font-semibold text-muted">标签</p>
          {tagName && (
            <Link
              href={buildTagHref(searchParams, null)}
              className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary-soft px-2.5 py-1 text-[11px] font-medium text-primary transition-colors hover:border-primary hover:bg-white hover:text-primary"
            >
              清除筛选
              <span aria-hidden>×</span>
            </Link>
          )}
          <div className="flex flex-1 flex-wrap gap-2">
            {libraryTags.map((tag) => {
              const active = tagName === tag.name;
              const href = buildTagHref(searchParams, active ? null : tag.name);
              return (
                <Link
                  key={tag.name}
                  href={href}
                  aria-pressed={active}
                  className={cn(
                    "inline-flex cursor-pointer items-center rounded-full border px-3 py-1 text-[12px] font-medium transition-colors",
                    active
                      ? "border-primary bg-primary text-white shadow-sm"
                      : "border-line bg-white text-muted hover:border-primary/50 hover:text-primary",
                  )}
                  style={!active ? { color: tag.color, borderColor: `${tag.color}66` } : undefined}
                >
                  # {tag.name}
                </Link>
              );
            })}
          </div>
        </div>

        <Link
          href="/knowledge/graph"
          className="flex items-center gap-3 rounded-2xl border border-line bg-card p-3 shadow-card transition-colors hover:border-primary/40 hover:bg-primary-soft/30"
        >
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft/60 text-primary"
            aria-hidden
          >
            <Network className="size-5" strokeWidth={1.8} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-ink">私域知识图谱</p>
            <p className="truncate text-[11px] text-muted">我的发表 × 收藏论文 · 分层视图 →</p>
          </div>
        </Link>
      </div>

      {/* 表头 */}
      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_220px_90px] items-center gap-4 rounded-xl bg-card px-5 py-3 text-xs text-faint shadow-card">
        <span className="flex items-center gap-3">
          <span className="size-4 rounded border border-line" />
          标题
        </span>
        <span>作者</span>
        <span>添加时间</span>
      </div>

      {/* 数据行 */}
      <div className="mt-3 space-y-2">
        {filtered.map((item, index) => (
          <div
            key={item.recordId ?? `${item.id}-${index}`}
            onClick={() => router.push(`/papers/${item.id}`)}
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
                <p className="flex items-center gap-1.5 truncate text-[15px] font-semibold text-ink">
                  <span className="truncate">{item.title}</span>
                  {bookmarkedPapers[item.id] && (
                    <span className="shrink-0 rounded bg-primary-soft px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      已收藏
                    </span>
                  )}
                </p>
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-faint">
                  <span>{item.venue} · {item.arxiv}</span>
                  {item.tags && item.tags.length > 0 && (
                    <span className="truncate text-muted">
                      · {item.tags.map((t) => `#${t}`).join(" ")}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <p className="truncate text-[13px] text-muted">{item.authors}</p>
            <p className="text-[13px] text-muted">{item.addedAt}</p>
          </div>
        ))}
      </div>
      {filtered.length === 0 && (
        <div className="mt-3 rounded-2xl bg-card p-12 text-center text-sm text-faint shadow-card">
          {tagName ? `"${folderName}" 中未找到 #${tagName} 相关文献` : `"${folderName}" 文件夹中暂无文献`}
        </div>
      )}
    </div>
  );
}

