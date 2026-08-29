import { AppShell } from "@/components/layout/app-shell";
import { LibraryTable } from "@/components/features/knowledge/library-table";

/** 论文库页面 `/knowledge/papers` —— 三栏改两栏：原中栏 LibraryPanel 迁入全局侧边栏「知识库 → 论文」展开区。 */
export default function PapersLibraryPage() {
  return (
    <AppShell>
      <LibraryTable />
    </AppShell>
  );
}

