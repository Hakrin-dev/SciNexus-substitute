"use client";

import {
  Bookmark,
  Download,
  MessageSquare,
  Share2,
  ThumbsUp,
} from "lucide-react";
import { useUserPreferences } from "@/stores/user-preferences";
import { cn } from "@/lib/utils";

/** 阅读器顶栏 —— Paper / AI Blog 切换 + 标题 + 操作 */
export function PaperTopbar({ paperId, title, likes }: { paperId: string; title: string; likes: number }) {
  const liked = useUserPreferences((s) => !!s.likedPapers[paperId]);
  const bookmarked = useUserPreferences((s) => !!s.bookmarkedPapers[paperId]);
  const toggleLike = useUserPreferences((s) => s.toggleLike);
  const toggleBookmark = useUserPreferences((s) => s.toggleBookmark);

  return (
    <header className="flex h-12 shrink-0 items-center gap-6 border-b border-line bg-card px-5">
      <div className="flex items-center gap-2 text-sm">
        <span className="flex items-center gap-1.5 rounded-md border border-primary px-2.5 py-1 font-medium text-primary">
          <Bookmark className="size-3.5" />
          Paper
        </span>
        <button
          type="button"
          className="flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-muted transition-colors hover:text-ink-2"
        >
          <MessageSquare className="size-3.5" />
          AI Blog
        </button>
      </div>

      <p className="min-w-0 flex-1 truncate text-sm text-muted">{title}</p>

      <div className="flex items-center gap-1 text-muted">
        <button
          type="button"
          onClick={() => toggleLike(paperId)}
          className={cn(
            "flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] transition-colors",
            liked ? "text-primary" : "hover:bg-chip",
          )}
        >
          <ThumbsUp className="size-4" fill={liked ? "currentColor" : "none"} />
          {likes + (liked ? 1 : 0)}
        </button>
        <button
          type="button"
          aria-label="收藏"
          onClick={() => toggleBookmark(paperId)}
          className={cn(
            "cursor-pointer rounded-lg p-2 transition-colors",
            bookmarked ? "text-primary" : "hover:bg-chip",
          )}
        >
          <Bookmark className="size-4" fill={bookmarked ? "currentColor" : "none"} />
        </button>
        <button type="button" aria-label="下载" className="cursor-pointer rounded-lg p-2 hover:bg-chip">
          <Download className="size-4" />
        </button>
        <button type="button" aria-label="分享" className="cursor-pointer rounded-lg p-2 hover:bg-chip">
          <Share2 className="size-4" />
        </button>
      </div>
    </header>
  );
}
