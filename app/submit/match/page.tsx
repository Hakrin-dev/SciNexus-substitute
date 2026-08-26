import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { SubmitMatch } from "@/components/features/submit/match/submit-match";

export const metadata: Metadata = {
  title: "AI 投稿匹配 | 研枢 SciNexus",
  description: "粘贴论文标题与摘要,获取最匹配的会议/期刊推荐(Top5)",
};

/** 投稿匹配页 `/submit/match` —— 独立入口,由 /submit 页头卡片跳入 */
export default function SubmitMatchPage() {
  return (
    <AppShell>
      <SubmitMatch />
    </AppShell>
  );
}
