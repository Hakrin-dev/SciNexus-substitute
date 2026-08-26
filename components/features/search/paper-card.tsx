"use client";

import Link from "next/link";
import { ArrowRight, Bookmark, Plus, ThumbsUp, TrendingUp, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useUserPreferences } from "@/stores/user-preferences";
import { toast } from "@/stores/toast";
import type { FeedPaper } from "@/types";

const VENUE_VARIANT = { violet: "violet", amber: "amber", green: "green" } as const;

/** 论文卡片 —— 对应主发现页 SVG 的 Feed 卡片 */
export function PaperCard({ paper, index }: { paper: FeedPaper; index: number }) {
  // 细粒度选择器:只订阅本卡片相关状态,避免任一卡片点赞触发全列表重渲染
  const liked = useUserPreferences((s) => !!s.likedPapers[paper.id]);
  const bookmarked = useUserPreferences((s) => !!s.bookmarkedPapers[paper.id]);
  const toggleLike = useUserPreferences((s) => s.toggleLike);
  const toggleBookmark = useUserPreferences((s) => s.toggleBookmark);

  return (
    <article
      className="animate-in fade-in slide-in-from-bottom-4 fill-mode-both rounded-2xl bg-card p-6 shadow-card duration-[350ms]"
      style={{ animationDelay: `${Math.min(index * 50, 350)}ms` }}
    >
      <div className="flex gap-6">
        <div className="min-w-0 flex-1">
          {/* 元信息行 */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
            <span className="text-faint">{paper.date}</span>
            <Badge variant={VENUE_VARIANT[paper.venueTone]}>{paper.venue}</Badge>
            <span className="flex items-center gap-1.5 text-muted">
              <Users className="size-3.5 text-faint" />
              {paper.authors}
            </span>
          </div>

          {/* 标题 */}
          <Link href={`/papers/${paper.id}`} className="group mt-2 block">
            <h3 className="text-[17px] font-bold leading-snug text-ink transition-colors group-hover:text-primary">
              {paper.title}
            </h3>
          </Link>

          {/* 摘要 */}
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">
            {paper.abstract}
          </p>

          {/* AI 解读入口 */}
          <Link
            href={`/papers/${paper.id}`}
            className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline"
          >
            <Plus className="size-3.5" />
            {paper.aiLink}
            <ArrowRight className="size-3.5" />
          </Link>

          {/* 底部操作行 */}
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {paper.tags.map((tag) => (
                <span key={tag} className="text-[13px] text-muted">
                  #{tag}
                </span>
              ))}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                aria-label={liked ? "取消点赞" : "点赞"}
                onClick={() => {
                  toggleLike(paper.id);
                  if (!liked) toast.success("已点赞");
                }}
                className={
                  "flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] transition-colors " +
                  (liked ? "text-primary" : "text-muted hover:bg-chip")
                }
              >
                <ThumbsUp className="size-4" fill={liked ? "currentColor" : "none"} />
                {paper.likes + (liked ? 1 : 0)}
              </button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  toggleBookmark(paper.id);
                  if (!bookmarked) toast.success("已收藏,可在「知识库 · 在读」中查看");
                }}
                className={bookmarked ? "text-primary" : undefined}
              >
                <Bookmark className="size-4" fill={bookmarked ? "currentColor" : "none"} />
                收藏
              </Button>
              <Link href={`/papers/${paper.id}`}>
                <Button size="sm" className="h-9 rounded-lg px-4 text-[13px]">
                  立即阅读
                  <ArrowRight className="size-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* 右侧缩略图 */}
        <div className="relative hidden w-[200px] shrink-0 md:block">
          <div className="absolute -top-2 right-2 z-10 flex items-center gap-1 rounded-full bg-card px-2.5 py-1 text-xs text-muted shadow-card">
            <TrendingUp className="size-3 text-primary" />
            引用 {paper.citations}
          </div>
          <div className="flex h-full min-h-[128px] items-center justify-center rounded-xl bg-chip text-sm text-faint">
            {paper.thumb}
          </div>
        </div>
      </div>
    </article>
  );
}
