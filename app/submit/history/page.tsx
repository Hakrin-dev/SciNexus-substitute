import { AppShell } from "@/components/layout/app-shell";
import { DeliveryHistory } from "@/components/features/submit/submit-page";

/** 投稿历史 `/submit/history` —— 原投稿页「History」视图,由侧边栏「历史 > 投稿历史」进入 */
export default function SubmitHistoryPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-[1180px] px-8 py-6">
        <DeliveryHistory />
      </div>
    </AppShell>
  );
}
