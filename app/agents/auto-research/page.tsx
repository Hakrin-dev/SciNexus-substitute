import { AppShell } from "@/components/layout/app-shell";
import { ResearchBoard } from "@/components/features/research/research-board";

/**
 * Auto Research `/agents/auto-research`
 * 自治研究流水线原型:流程画布 + 执行面板 + 产物档案(预录事件流,无后端)
 */
export default function AutoResearchPage() {
  return (
    <AppShell>
      <ResearchBoard />
    </AppShell>
  );
}
