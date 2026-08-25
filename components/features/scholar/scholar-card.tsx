"use client";

import { useRouter } from "next/navigation";
import { FollowButton } from "./follow-button";
import type { Scholar } from "@/types";

/** 学者卡片 —— 对应学者画像页 SVG 的双列卡片 */
export function ScholarCard({ scholar, index }: { scholar: Scholar; index: number }) {
  const router = useRouter();

  return (
    <article
      onClick={() => router.push(`/scholars/${scholar.id}`)}
      className="animate-in fade-in slide-in-from-bottom-4 fill-mode-both cursor-pointer rounded-2xl bg-card p-5 shadow-card transition-shadow hover:shadow-pop duration-[350ms]"
      style={{ animationDelay: `${Math.min(index * 40, 280)}ms` }}
    >
      <div className="flex gap-4">
        <span
          className="flex size-16 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white"
          style={{ backgroundColor: scholar.avatarColor }}
        >
          {scholar.initials}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-[15px] font-bold text-ink">
              {scholar.nameCn} · {scholar.nameEn}
            </h3>
            <FollowButton scholarId={scholar.id} defaultFollowing={scholar.followed} />
          </div>

          <p className="mt-1 text-xs text-muted">
            {scholar.role} · {scholar.affiliation}
          </p>
          <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-muted">
            {scholar.bio}
          </p>

          <p className="mt-2.5 text-[13px]">
            <span className="font-bold text-ink">{scholar.citations}</span>
            <span className="ml-1 text-muted">引用</span>
            <span className="ml-4 font-bold text-ink">{scholar.hIndex}</span>
            <span className="ml-1 text-muted">h-index</span>
          </p>

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {scholar.tags.map((tag) => (
              <span key={tag} className="text-xs text-muted">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}
