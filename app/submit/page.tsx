import { AppShell } from "@/components/layout/app-shell";
import { SubmitBrowser } from "@/components/features/submit/submit-browser";

/** 投稿详情页 `/submit` —— 对应「深知-投稿详情页.svg」 */
export default function SubmitPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-[1180px] px-8 py-6">
        <SubmitBrowser />
      </div>
    </AppShell>
  );
}
