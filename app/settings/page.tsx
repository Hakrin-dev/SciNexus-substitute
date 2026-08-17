import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { SettingsTabs } from "./settings-tabs";

/** 设置页 `/settings` —— Tab 受控于 ?tab= 参数(如 /settings?tab=api) */
export default function SettingsPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-[960px] px-8 py-10">
        <h1 className="text-xl font-bold text-ink">设置</h1>
        <div className="mt-6">
          <Suspense>
            <SettingsTabs />
          </Suspense>
        </div>
      </div>
    </AppShell>
  );
}
