import { AppShell } from "@/components/layout/app-shell";
import { SubmitBrowser } from "@/components/features/submit/submit-browser";

/** 投稿 · 期刊 `/submit/journals` */
export default function SubmitJournalsPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-[1180px] px-8 py-6">
        <SubmitBrowser kind="journal" />
      </div>
    </AppShell>
  );
}
