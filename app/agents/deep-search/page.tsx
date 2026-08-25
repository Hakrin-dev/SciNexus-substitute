"use client";

import { Suspense, useCallback, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { ResearchNav } from "@/components/features/agent/research-nav";
import { DeepSearchResults } from "@/components/features/agent/deep-search-results";

/**
 * 深度搜索结果页 `/agents/deep-search` —— 对应「深知-AI研究助手.svg」,
 * 发现页「深度搜索」按钮的跳转目标。读取 ?q= 参数并调用后端 /api/search
 * 展示真实检索结果（由 /agents/deep-research 迁移而来）。
 */
export default function DeepSearchPage() {
  // 「开启新研究」：递增信号，DeepSearchResults 据此清空会话状态
  const [resetSignal, setResetSignal] = useState(0);
  const handleNewResearch = useCallback(() => {
    setResetSignal((n) => n + 1);
  }, []);

  return (
    <AppShell>
      <div className="mx-auto flex max-w-[1180px] items-start gap-8 px-8 py-6">
        <ResearchNav onNewResearch={handleNewResearch} />

        <div className="min-w-0 flex-1 space-y-5">
          <Suspense
            fallback={
              <div className="py-16 text-center text-sm text-faint">
                正在加载…
              </div>
            }
          >
            <DeepSearchResults resetSignal={resetSignal} />
          </Suspense>
        </div>
      </div>
    </AppShell>
  );
}