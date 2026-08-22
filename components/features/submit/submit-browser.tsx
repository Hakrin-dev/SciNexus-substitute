"use client";

import { useState } from "react";
import { FilterPanel } from "./filter-panel";
import { VenueCard } from "./venue-card";
import { useVenues } from "@/lib/api/services";

/** 等级 chip → 徽章名映射(用于过滤) */
const LEVEL_TO_BADGE: Record<string, string> = {
  "CCF-A": "CCF A",
  "CCF-B": "CCF B",
  "CCF-C": "CCF C",
  "CAAI-A": "CAAI A",
  "CAAI-C": "CAAI C",
  "CORE-A*": "CORE A*",
  "TH-CPL A": "TH-CPL A",
  "TH-CPL B": "TH-CPL B",
  中科院1区: "中科院1区",
};

/** 投稿浏览区 —— 等级过滤 + 卡片列表;顶部的两组切换 tab 在 submit-page.tsx */
export function SubmitBrowser({ kind }: { kind: "conference" | "journal" }) {
  const [levels, setLevels] = useState<string[]>([]);
  const { data: venues = [] } = useVenues();

  const toggleLevel = (chip: string) =>
    setLevels((prev) =>
      prev.includes(chip) ? prev.filter((c) => c !== chip) : [...prev, chip],
    );

  const base = venues.filter((v) => v.kind === kind);
  const filtered =
    levels.length === 0
      ? base
      : base.filter((v) =>
          levels.some((chip) => {
            const badge = LEVEL_TO_BADGE[chip];
            return badge && v.badges.includes(badge as never);
          }),
        );

  return (
    <>
      <div className="text-right text-sm text-faint">
        {levels.length === 0 ? base.length : filtered.length} 条结果
      </div>

      <div className="mt-3 grid items-start gap-6 xl:grid-cols-[300px_1fr]">
        <FilterPanel activeLevels={levels} onToggleLevel={toggleLevel} />
        <div className="space-y-6">
          {filtered.map((venue, i) => (
            <VenueCard key={venue.id} venue={venue} index={i} />
          ))}
          {filtered.length === 0 && (
            <div className="rounded-2xl bg-card p-12 text-center text-sm text-faint shadow-card">
              暂无符合筛选条件的{kind === "conference" ? "会议" : "期刊"}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
