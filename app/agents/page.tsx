import { AppShell } from "@/components/layout/app-shell";
import { AgentChat } from "@/components/features/agent/agent-chat";

/** AI 助手页 `/agents` —— 类似网页版 ChatGPT 的对话界面 */
export default function AgentsPage() {
  return (
    <AppShell>
      <AgentChat />
    </AppShell>
  );
}
