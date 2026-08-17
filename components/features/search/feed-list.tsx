"use client";

import { PaperCard } from "./paper-card";
import { useFeedPapers } from "@/lib/api/services";

/** Feed 列表 —— 真实后端 /api/papers + mock 保底（placeholderData 避免闪烁） */
export function FeedList() {
  const { data } = useFeedPapers();

  return (
    <div className="space-y-5">
      {(data ?? []).map((paper, i) => (
        <PaperCard key={paper.id} paper={paper} index={i} />
      ))}
    </div>
  );
}
