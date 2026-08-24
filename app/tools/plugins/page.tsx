import { Plug } from "lucide-react";
import { ToolPage } from "@/components/features/tools/tool-page";

/** Plugin Market `/tools/plugins` —— 插件市场(演示占位) */
export default function PluginMarketPage() {
  return (
    <ToolPage
      title="Plugin Market"
      icon={Plug}
      placeholder="插件市场(演示占位)"
    />
  );
}
