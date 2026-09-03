"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { WorkbenchShell } from "@/components/features/projects/workbench/workbench-shell";

/**
 * 课题工作台 `/projects/[id]` —— 三栏工作台(左大纲轨 / 主工作区五视图 / 右上下文面板 + 底部 Agent 栏)。
 * 数据来自 Next.js Route Handlers；公共示例在接口不可达时可回退只读演示数据。
 */
export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const id = params.id ?? "";

  return (
    <AppShell>
      {/* WorkbenchShell 使用 useSearchParams,静态渲染需 Suspense 边界 */}
      <Suspense fallback={null}>
        <WorkbenchShell projectId={id} />
      </Suspense>
    </AppShell>
  );
}
