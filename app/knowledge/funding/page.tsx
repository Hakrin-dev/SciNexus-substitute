import { AppShell } from "@/components/layout/app-shell";
import { FundingBrowser } from "@/components/features/knowledge/funding-browser";

/** 项目基金库 `/knowledge/funding` —— 两栏布局,对齐 `/knowledge` 论文库 */
export default function FundingPage() {
  return (
    <AppShell>
      <div className="flex min-h-[calc(100vh)] items-stretch">
        <FundingBrowser />
      </div>
    </AppShell>
  );
}
