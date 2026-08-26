import type { Metadata } from "next";
import { Archive } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { ArchivedProjects } from "@/components/features/projects/archived-projects";

export const metadata: Metadata = {
  title: "归档项目 | 研枢 SciNexus",
};

/** 归档项目 `/my-projects` —— 已完成/已搁置项目,支持恢复 */
export default function MyProjectsPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-[1180px] space-y-5 px-8 py-6">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft">
            <Archive className="size-5 text-primary" />
          </span>
          <h1 className="text-xl font-bold text-ink">归档项目</h1>
        </div>
        <ArchivedProjects />
      </div>
    </AppShell>
  );
}
