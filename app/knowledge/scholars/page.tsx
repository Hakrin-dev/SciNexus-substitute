import { AppShell } from "@/components/layout/app-shell";
import { ScholarsBrowser } from "@/components/features/scholar/scholars-browser";

/** 学者关系 `/knowledge/scholars` —— 对应「深知-学者画像页.svg」(原「研究构想」页) */
export default function KnowledgeScholarsPage() {
  return (
    <AppShell>
      <div className="min-h-[calc(100vh)]">
        <ScholarsBrowser />
      </div>
    </AppShell>
  );
}
