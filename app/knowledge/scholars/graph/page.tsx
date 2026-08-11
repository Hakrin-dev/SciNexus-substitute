import { AppShell } from "@/components/layout/app-shell";
import { ScholarNetwork } from "@/components/features/scholar/scholar-network";

/** 学者合作关系图谱示例 —— 与私域论文图谱完全独立 */
export default function ScholarGraphPage() {
  return (
    <AppShell>
      <ScholarNetwork />
    </AppShell>
  );
}
