import { AppShell } from "@/components/layout/app-shell";
import { DatabaseBrowser } from "@/components/features/database/database-browser";

/** 科研数据库 `/database` —— 跨库检索演示原型(前端 mock,不连后端) */
export default function DatabasePage() {
  return (
    <AppShell>
      <DatabaseBrowser />
    </AppShell>
  );
}
