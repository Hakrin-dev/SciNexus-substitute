"use client";

import { PaperCard } from "./paper-card";
import { RefreshCw } from "lucide-react";
import { useRandomKnowledgePapers } from "@/lib/api/services";
import { Button } from "@/components/ui/button";

/** 首页 Feed 列表 —— 每次加载从远程知识底座随机获取 10 篇论文。 */
export function FeedList() {
  const { data, isLoading, isError, refetch, isFetching } = useRandomKnowledgePapers();

  if (isLoading) {
    return <p className="px-1 py-8 text-center text-sm text-muted">正在从知识底座加载随机论文…</p>;
  }

  if (isError) {
    return (
      <div className="mx-1 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <p>知识底座论文推荐暂不可用，本次没有使用本地演示论文替代。</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => void refetch()} disabled={isFetching}>
          <RefreshCw className="size-3.5" />
          {isFetching ? "重新加载中…" : "重新加载"}
        </Button>
      </div>
    );
  }

  if (!data?.length) {
    return <p className="px-1 py-8 text-center text-sm text-muted">知识底座暂未返回论文推荐。</p>;
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between px-1 text-sm text-muted">
        <span>来自知识底座的随机论文 · {data?.length ?? 0} 篇</span>
        <Button variant="ghost" size="sm" onClick={() => void refetch()} disabled={isFetching}>
          <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
          换一批
        </Button>
      </div>
      <div className="space-y-5">
      {(data ?? []).map((paper, i) => (
        <PaperCard key={paper.id} paper={paper} index={i} />
      ))}
      </div>
    </div>
  );
}
