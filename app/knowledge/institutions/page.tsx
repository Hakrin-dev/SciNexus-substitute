import { AppShell } from "@/components/layout/app-shell";
import { InstitutionsBrowser } from "@/components/features/institution/institutions-browser";

/** 研究机构 `/knowledge/institutions` —— 单列大卡片,参考学者关系页 */
export default function InstitutionsPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-[960px] px-8 py-6">
        <InstitutionsBrowser />
      </div>
    </AppShell>
  );
}
