"use client";

import { useParams } from "next/navigation";
import { GraphPageLayout } from "@/components/features/graph/graph-page-layout";
import { usePublicGraph } from "@/lib/api/services";
import { cn } from "@/lib/utils";

/** 公域知识图谱 `/papers/[id]/graph` —— 沉浸式(不使用全局侧边栏) */
export default function PaperGraphPage() {
  const { id } = useParams<{ id: string }>();
  const { data: graph } = usePublicGraph();
  if (!graph) return null;

  return (
    <div className="flex h-screen flex-col bg-background">
      <GraphPageLayout
        graph={graph}
        mode="concentric"
        backHref={`/papers/${id}`}
        backLabel="返回阅读器"
        title={graph.origin.title}
        headerExtra={
          <div className="flex rounded-lg border border-line text-[13px]">
            {["Prior works", "Derivative works"].map((label, i) => (
              <span
                key={label}
                className={cn(
                  "px-3 py-1.5",
                  i === 0
                    ? "rounded-l-[7px] bg-primary-soft font-medium text-primary"
                    : "rounded-r-[7px] text-faint",
                )}
              >
                {label}
              </span>
            ))}
          </div>
        }
      />
    </div>
  );
}
