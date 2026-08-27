import type { Metadata } from "next";
import { Brain } from "lucide-react";
import { KnowledgePage } from "@/components/features/knowledge/knowledge-page";
import { MemoryBoard } from "@/components/features/knowledge/memory-board";
import { MemoryMasterToggle } from "@/components/features/knowledge/memory-master-toggle";

export const metadata: Metadata = {
  title: "AI 记忆 | 研枢 SciNexus",
  description: "助手关于你的长期记忆,可随时查看、停用或删除",
};

/** 知识库·AI 记忆 `/knowledge/memory` —— 演示态(本地持久化) */
export default function KnowledgeMemoryPage() {
  return (
    <KnowledgePage
      title="记忆"
      subtitle="AI 助手的长期记忆,可随时查看、停用或删除"
      icon={Brain}
      headerRight={<MemoryMasterToggle />}
    >
      <MemoryBoard />
    </KnowledgePage>
  );
}
