import { AppShell } from "@/components/layout/app-shell";

/** 知识库子栏目占位页 —— 内容建设中 */
export function KnowledgeStub({ title }: { title: string }) {
  return (
    <AppShell>
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted">{title} · 内容建设中</p>
      </div>
    </AppShell>
  );
}
