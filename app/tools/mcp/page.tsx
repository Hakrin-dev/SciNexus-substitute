import { McpIcon } from "@/components/icons/mcp-icon";
import { ToolPage } from "@/components/features/tools/tool-page";
import { McpGuide } from "@/components/features/tools/mcp-guide";
import { McpBoard } from "@/components/features/tools/mcp-board";

/** MCP Server `/tools/mcp` —— 说明与引导(alphaXiv 风格)+ 我的服务器管理(演示态) */
export default function McpServerPage() {
  return (
    <ToolPage
      title="MCP Server"
      subtitle="通过 Model Context Protocol 接入外部工具与数据源"
      icon={McpIcon}
      placeholder="MCP 服务器配置(演示占位)"
    >
      <div className="space-y-10">
        <McpGuide />
        {/* 我的服务器(本地演示态管理) */}
        <section className="border-t border-line pt-8">
          <h2 className="text-lg font-bold text-ink">我的服务器</h2>
          <p className="mt-1 text-[13px] text-muted">
            以下连接配置保存在本机浏览器;实际连接能力以后端上线为准。
          </p>
          <div className="mt-4">
            <McpBoard />
          </div>
        </section>
      </div>
    </ToolPage>
  );
}
