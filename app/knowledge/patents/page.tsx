import { AppShell } from "@/components/layout/app-shell";
import { PatentsBrowser } from "@/components/features/knowledge/patents-browser";

/** 专利库 `/knowledge/patents` —— 两栏布局,对齐 `/knowledge` 论文库 */
export default function PatentsPage() {
  return (
    <AppShell>
      <div className="flex min-h-[calc(100vh)] items-stretch">
        <PatentsBrowser />
      </div>
    </AppShell>
  );
}
