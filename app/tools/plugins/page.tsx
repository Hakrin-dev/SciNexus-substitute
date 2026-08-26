import { Plug } from "lucide-react";
import { ToolPage } from "@/components/features/tools/tool-page";
import { PluginsBoard } from "@/components/features/tools/plugins-board";

/** Plugin Market `/tools/plugins` —— 插件市场(演示数据,安装态本地持久化) */
export default function PluginsMarketPage() {
  return (
    <ToolPage
      title="Plugin Market"
      subtitle="连接第三方工具与工作流,安装后可在对话中调用"
      icon={Plug}
      placeholder="插件市场(演示占位)"
    >
      <PluginsBoard />
    </ToolPage>
  );
}
