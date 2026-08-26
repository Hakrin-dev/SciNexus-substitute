import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { MemoryBoard } from "@/components/features/knowledge/memory-board";

export const metadata: Metadata = {
  title: "AI 记忆 | 研枢 SciNexus",
  description: "助手关于你的长期记忆,可随时查看、停用或删除",
};

/** 知识库·AI 记忆 `/knowledge/memory` —— 演示态(本地持久化) */
export default function KnowledgeMemoryPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-[1180px] space-y-5 px-8 py-6">
        <div>
          <h1 className="text-xl font-bold text-ink">记忆</h1>
          <p className="mt-0.5 text-xs text-faint">AI 助手的长期记忆管理</p>
        </div>
        <MemoryBoard />
      </div>
    </AppShell>
  );
}
