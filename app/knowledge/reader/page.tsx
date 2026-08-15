import { AppShell } from "@/components/layout/app-shell";
import { ReaderView } from "@/components/features/knowledge/reader-view";

/** 文献精读 `/knowledge/reader` —— PDF 上传后 AI 解析的演示阅读页 */
export default function ReaderPage() {
  return (
    <AppShell>
      <ReaderView />
    </AppShell>
  );
}
