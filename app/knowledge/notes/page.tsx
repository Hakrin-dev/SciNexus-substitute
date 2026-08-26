import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { NotesBoard } from "@/components/features/knowledge/notes-board";

export const metadata: Metadata = {
  title: "笔记 | 研枢 SciNexus",
  description: "阅读与研究笔记,支持标签筛选与关联论文",
};

/** 知识库·笔记 `/knowledge/notes` —— 演示态(本地持久化) */
export default function KnowledgeNotesPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-[1180px] space-y-5 px-8 py-6">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-xl font-bold text-ink">笔记</h1>
            <p className="mt-0.5 text-xs text-faint">
              记录阅读心得与研究思路,可关联论文与标签
            </p>
          </div>
        </div>
        <NotesBoard />
      </div>
    </AppShell>
  );
}
