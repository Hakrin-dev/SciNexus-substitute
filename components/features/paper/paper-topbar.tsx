"use client";

import {
  Bookmark,
  Download,
  MessageSquare,
  Share2,
  ThumbsUp,
} from "lucide-react";
import { useUserPreferences } from "@/stores/user-preferences";
import { copyText, toast } from "@/stores/toast";
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
          disabled
          title="AI Blog：即将上线"
          className="flex cursor-not-allowed items-center gap-1.5 rounded-md px-2.5 py-1 text-muted"
        >
          <MessageSquare className="size-3.5" />
          AI Blog
        </button>
      </div>

      <p className="min-w-0 flex-1 truncate text-sm text-muted">{title}</p>

      <div className="flex items-center gap-1 text-muted">
        <button
          type="button"
          aria-label={liked ? "取消点赞" : "点赞"}
          onClick={() => {
            toggleLike(paperId);
            if (!liked) toast.success("已点赞");
          }}
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
          aria-label={bookmarked ? "取消收藏" : "收藏"}
          onClick={() => {
            toggleBookmark(paperId);
            if (!bookmarked) toast.success("已收藏,可在「知识库 · 在读」中查看");
          }}
          className={cn(
            "cursor-pointer rounded-lg p-2 transition-colors",
            bookmarked ? "text-primary" : "hover:bg-chip",
          )}
        >
          <Bookmark className="size-4" fill={bookmarked ? "currentColor" : "none"} />
        </button>
        <button
          type="button"
          disabled
          aria-label="下载"
          title="PDF 下载：即将上线"
          className="cursor-not-allowed rounded-lg p-2 text-faint"
        >
          <Download className="size-4" />
        </button>
        <button
          type="button"
          aria-label="分享"
          onClick={() => copyText(window.location.href, "论文链接已复制")}
          className="cursor-pointer rounded-lg p-2 hover:bg-chip"
        >
          <Share2 className="size-4" />
        </button>
      </div>
    </header>
  );
}
