"use client";

import { PaperCard } from "./paper-card";
import { useFeedPapers } from "@/lib/api/services";

/** Feed 列表 —— 真实接口 + mock 保底 */
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
