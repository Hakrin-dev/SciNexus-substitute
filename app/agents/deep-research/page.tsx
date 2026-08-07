import { AppShell } from "@/components/layout/app-shell";
import { DeepResearchPageClient } from "@/components/features/deep-research/deep-research-page";

/**
 * Deep Research 页 `/agents/deep-research` —— 研究报告型双栏工作台:
 * 入口态(新建 / 历史)+ Session 态(左栏过程,右栏报告逐节生成)
 *
 * URL 参数在服务端解析后透传给客户端组件,保证 headless 截图直接拿到
 * 目标态的 SSR HTML:
 *   ?mode=instant  直接完成态
 *   ?autostart=1   进入 session 从头播放
 *   ?q=xxx         预填问题并进入 session 播放
 */
export default async function DeepResearchPage({
  searchParams,
}: {
  searchParams?: Promise<{
    [key: string]: string | string[] | undefined;
  }>;
}) {
  const params = searchParams ? await searchParams : {};
  return (
    <AppShell>
      <DeepResearchPageClient
        mode={params.mode}
        autostart={params.autostart}
        q={params.q}
      />
    </AppShell>
  );
}
