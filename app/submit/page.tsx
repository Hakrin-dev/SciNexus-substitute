import { AppShell } from "@/components/layout/app-shell";
import { SubmitHome } from "@/components/features/submit/submit-page";

/** 投稿 `/submit` —— 会议 / 期刊 页内切换;投递历史已独立为 /submit/history(侧边栏「历史 > 投稿历史」) */
export default function SubmitPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-[1180px] px-8 py-6">
        <SubmitHome />
      </div>
    </AppShell>
  );
}
