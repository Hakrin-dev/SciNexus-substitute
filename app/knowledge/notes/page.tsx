import type { Metadata } from "next";
import { Feather } from "lucide-react";
import { KnowledgePage } from "@/components/features/knowledge/knowledge-page";
import { NotesBoard } from "@/components/features/knowledge/notes-board";

export const metadata: Metadata = {
  title: "笔记 | 研枢 SciNexus",
  description: "阅读与研究笔记,支持标签筛选与关联论文",
};

/** 知识库·笔记 `/knowledge/notes` —— 演示态(本地持久化) */
export default function KnowledgeNotesPage() {
  return (
    <KnowledgePage
      title="笔记"
      subtitle="记录阅读心得与研究思路,可关联论文与标签"
      icon={Feather}
    >
      <NotesBoard />
    </KnowledgePage>
  );
}
