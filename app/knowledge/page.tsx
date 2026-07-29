import { AppShell } from "@/components/layout/app-shell";
import { LibraryPanel } from "@/components/features/knowledge/library-panel";
import { LibraryTable } from "@/components/features/knowledge/library-table";

/** 知识库页面 `/knowledge` —— 对应「深知-知识库页面.svg」 */
export default function KnowledgePage() {
  return (
    <AppShell>
      <div className="flex min-h-[calc(100vh)] items-stretch">
        <LibraryPanel />
        <LibraryTable />
      </div>
    </AppShell>
  );
}
