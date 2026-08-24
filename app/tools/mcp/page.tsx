import { McpIcon } from "@/components/icons/mcp-icon";
import { ToolPage } from "@/components/features/tools/tool-page";

/** MCP Server `/tools/mcp` —— MCP 服务器配置(演示占位) */
export default function McpServerPage() {
  return (
    <ToolPage
      title="MCP Server"
      icon={McpIcon}
      placeholder="MCP 服务器配置(演示占位)"
    />
  );
}
