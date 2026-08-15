import { AppShell } from "@/components/layout/app-shell";
import { SubmitHome } from "@/components/features/submit/submit-page";

/** 投稿 `/submit` —— 会议 / 期刊 / 投递历史 三合一页面,左上角 tab 切换 */
export default function SubmitPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-[1180px] px-8 py-6">
        <SubmitHome />
      </div>
    </AppShell>
  );
}
