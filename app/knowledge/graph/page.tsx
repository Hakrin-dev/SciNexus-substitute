"use client";

import { AppShell } from "@/components/layout/app-shell";
import { GraphPageLayout } from "@/components/features/graph/graph-page-layout";
import { usePrivateGraph } from "@/lib/api/services";

/** 私域知识图谱 `/knowledge/graph` —— 我的发表 × 收藏论文 分层双色图；数据来自 /api/knowledge/graph */
export default function KnowledgeGraphPage() {
  const { data: graph } = usePrivateGraph();

  if (!graph) return null;

  return (
    <AppShell>
      <div className="flex h-[calc(100dvh-3.5rem)] flex-col bg-background lg:h-screen">
        <GraphPageLayout
          graph={graph}
          mode="strata"
          backHref="/knowledge"
          backLabel="返回知识库"
          title="私域知识图谱"
        />
      </div>
    </AppShell>
  );
}
