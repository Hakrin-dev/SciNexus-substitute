import { GraphPageLayout } from "@/components/features/graph/graph-page-layout";
import { publicGraph } from "@/lib/data/knowledge-graph";
import { cn } from "@/lib/utils";

/** 公域知识图谱 `/papers/[id]/graph` —— 沉浸式(不使用全局侧边栏) */
export default async function PaperGraphPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="flex h-screen flex-col bg-background">
      <GraphPageLayout
        graph={publicGraph}
        mode="concentric"
        backHref={`/papers/${id}`}
        backLabel="返回阅读器"
        title={publicGraph.origin.title}
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
