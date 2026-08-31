"use client";

import { useParams } from "next/navigation";
import { GraphPageLayout } from "@/components/features/graph/graph-page-layout";
import { usePublicGraph } from "@/lib/api/services";
import { cn } from "@/lib/utils";

/** 公域知识图谱 `/papers/[id]/graph` —— 沉浸式(不使用全局侧边栏)；数据来自 /api/papers/{id}/graph */
export default function PaperGraphPage() {
  const params = useParams<{ id: string }>();
  // Next 客户端参数在带冒号的远程 paper_id 上可能保留 %3A；传给查询前只解码一次，
  // 否则 URLSearchParams 会二次编码并触发无关的本地图谱回退。
  const rawId = params.id ?? "";
  let id = rawId;
  try {
    id = decodeURIComponent(rawId);
  } catch {
    // 保持原值，由 API 返回可解释错误。
  }
  const { data: graph, isLoading, isError, error } = usePublicGraph(id);

  if (isLoading && !graph) {
    return <main className="grid min-h-screen place-items-center text-sm text-muted">正在读取引用图谱…</main>;
  }
  if (isError && !graph) {
    return (
      <main className="grid min-h-screen place-items-center px-6 text-center">
        <div>
          <h1 className="text-lg font-semibold text-ink">当前论文暂无可用图谱</h1>
          <p className="mt-2 text-sm text-muted">{error instanceof Error ? error.message : "请稍后重试。"}</p>
          <a className="mt-4 inline-block text-sm text-primary hover:underline" href={`/papers/${encodeURIComponent(id)}`}>返回阅读器</a>
        </div>
      </main>
    );
  }
  if (!graph) return null;

  return (
    <div className="relative flex h-screen flex-col bg-background">
      <GraphPageLayout
        graph={graph}
        mode="concentric"
        backHref={`/papers/${id}`}
        backLabel="返回阅读器"
        title={graph.origin.title}
        headerExtra={
          <div className="flex items-center gap-2 text-[12px]">
            <span className={cn("rounded-md px-2 py-1", graph.source === "remote_knowledge_base" ? "bg-primary-soft text-primary" : "bg-chip text-muted")}>
              {graph.source === "remote_knowledge_base" ? "远程知识底座" : "本地图谱"}
            </span>
            <span className="text-faint">{graph.edges.length} 条有向关系</span>
          </div>
        }
      />
      {graph.nodes.length === 0 && (
        <p className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-card px-3 py-1.5 text-xs text-muted shadow-card">
          该论文已定位到知识底座，但当前未返回关联关系。
        </p>
      )}
    </div>
  );
}
