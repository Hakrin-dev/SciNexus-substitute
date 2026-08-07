"use client";

import { useMemo, useState } from "react";
import { Building2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InstitutionCard } from "./institution-card";
import { useDebounce } from "@/hooks/use-debounce";
import { institutions } from "@/lib/data/institutions";
import { useUserPreferences } from "@/stores/user-preferences";
import { cn } from "@/lib/utils";
import type { Institution } from "@/types";

const SORTS = [
  { key: "rank", label: "综合排名" },
  { key: "papers", label: "论文数" },
  { key: "followed", label: "已关注" },
];

/** 机构浏览区 —— 骨架对齐 ScholarsBrowser(横幅 + 搜索 + 排序),单列大卡片 */
export function InstitutionsBrowser() {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("rank");
  const debouncedQuery = useDebounce(query, 300);
  const { followedScholars } = useUserPreferences();

  const isFollowed = (i: Institution) =>
    followedScholars[`inst:${i.id}`] ?? i.followed ?? false;

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    let list = institutions;
    if (sort === "followed") list = list.filter((i) => isFollowed(i));
    if (q) {
      list = list.filter((i) =>
        [i.nameCn, i.nameEn, i.location, ...i.fields]
          .join(" ")
          .toLowerCase()
          .includes(q),
      );
    }
    return [...list].sort((a, b) =>
      sort === "papers" ? b.papersPerYear - a.papersPerYear : a.rank - b.rank,
    );
  }, [debouncedQuery, sort, followedScholars]);

  return (
    <div className="space-y-5">
      {/* 顶部横幅 */}
      <section className="flex items-center justify-between rounded-2xl bg-card px-8 py-7 shadow-card">
        <div className="flex items-center gap-4">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-primary-soft">
            <Building2 className="size-6 text-primary" />
          </span>
          <div>
            <p className="text-[15px] font-semibold text-ink">研究机构图谱</p>
            <p className="mt-0.5 text-xs text-muted">
              追踪全球顶尖高校、研究院与企业实验室的研究动态
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          className="rounded-full border-primary/40 text-primary hover:bg-primary-soft"
        >
          探索机构合作网络
          <span aria-hidden>→</span>
        </Button>
      </section>

      {/* 搜索 + 排序 */}
      <div className="flex items-center gap-3">
        <div className="relative w-full max-w-[420px]">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索机构名称、地点或研究方向…"
            aria-label="搜索研究机构"
            className="h-10 w-full rounded-xl border border-line bg-card pl-10 pr-4 text-sm text-ink outline-none transition-colors placeholder:text-faint focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/15"
          />
        </div>
        <div className="ml-auto flex gap-2">
          {SORTS.map((s) => (
            <button
              key={s.key}
              type="button"
              aria-pressed={sort === s.key}
              onClick={() => setSort(s.key)}
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

      {/* 单列大卡片 */}
      <div className="space-y-6">
        {filtered.map((institution, i) => (
          <InstitutionCard key={institution.id} institution={institution} index={i} />
        ))}
      </div>
      {filtered.length === 0 && (
        <div className="rounded-2xl bg-card p-12 text-center text-sm text-faint shadow-card">
          未找到匹配的机构
        </div>
      )}
    </div>
  );
}
