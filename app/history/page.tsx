import type { Metadata } from "next";
import { History } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { HistoryBoard } from "@/components/features/knowledge/history-board";

export const metadata: Metadata = {
  title: "浏览记录 | 研枢 SciNexus",
};

/** 浏览记录 `/history` —— 本地埋点(仅保存在本机浏览器) */
export default function HistoryPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-[1180px] space-y-5 px-8 py-6">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft">
            <History className="size-5 text-primary" />
          </span>
          <h1 className="text-xl font-bold text-ink">浏览记录</h1>
        </div>
        <HistoryBoard />
      </div>
    </AppShell>
  );
}
