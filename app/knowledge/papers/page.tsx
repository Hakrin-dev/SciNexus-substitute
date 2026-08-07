import { AppShell } from "@/components/layout/app-shell";
import { LibraryPanel } from "@/components/features/knowledge/library-panel";
import { LibraryTable } from "@/components/features/knowledge/library-table";

/** 论文库页面 `/knowledge/papers` —— 对应「深知-知识库页面.svg」,2026-08-07 由 /knowledge 迁入 */
export default function PapersLibraryPage() {
  return (
    <AppShell>
      <div className="flex min-h-[calc(100vh)] items-stretch">
        <LibraryPanel />
        <LibraryTable />
      </div>
    </AppShell>
  );
}
