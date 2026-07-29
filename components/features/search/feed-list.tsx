"use client";

import { useQuery } from "@tanstack/react-query";
import { PaperCard } from "./paper-card";
import { feedPapers } from "@/lib/data/papers";
import type { FeedPaper } from "@/types";

/** 模拟异步获取(后续替换为 Server Action / 真实 API) */
async function fetchFeed(): Promise<FeedPaper[]> {
  await new Promise((r) => setTimeout(r, 300));
  return feedPapers;
}

/** Feed 列表 —— TanStack Query 缓存 + 预填数据避免闪烁 */
export function FeedList() {
  const { data } = useQuery({
    queryKey: ["feed", "trending"],
    queryFn: fetchFeed,
    placeholderData: feedPapers,
  });

  return (
    <div className="space-y-5">
      {(data ?? []).map((paper, i) => (
        <PaperCard key={paper.id} paper={paper} index={i} />
      ))}
    </div>
  );
}
