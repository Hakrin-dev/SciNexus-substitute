import { AppShell } from "@/components/layout/app-shell";
import { KnowledgeDashboard } from "@/components/features/knowledge/knowledge-dashboard";

/** 知识库总览 `/knowledge` —— 跨库搜索 + 五类科研资产工作台 */
export default function KnowledgePage() {
  return (
    <AppShell>
      <KnowledgeDashboard />
    </AppShell>
  );
}
