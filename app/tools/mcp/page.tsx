import { McpIcon } from "@/components/icons/mcp-icon";
import { ToolPage } from "@/components/features/tools/tool-page";
import { McpGuide } from "@/components/features/tools/mcp-guide";
import { McpBoard } from "@/components/features/tools/mcp-board";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Server, BookOpen } from "lucide-react";

/** MCP Server `/tools/mcp` —— 我的服务器管理(演示态)+ 说明与引导(alphaXiv 风格) */
export default function McpServerPage() {
  return (
    <ToolPage
      title="MCP Server"
      subtitle="通过 Model Context Protocol 接入外部工具与数据源"
      icon={McpIcon}
      placeholder="MCP 服务器配置(演示占位)"
    >
      <Tabs defaultValue="servers">
        <TabsList className="gap-4 border-b border-line">
          <TabsTrigger value="servers" className="flex items-center gap-1.5">
            <Server className="size-4" strokeWidth={1.8} />
            我的服务器
          </TabsTrigger>
          <TabsTrigger value="guide" className="flex items-center gap-1.5">
            <BookOpen className="size-4" strokeWidth={1.8} />
            MCP 配置说明
          </TabsTrigger>
        </TabsList>
        <TabsContent value="servers" className="mt-5">
          <p className="mb-4 text-[13px] text-muted">
            以下连接配置保存在本机浏览器;实际连接能力以后端上线为准。
          </p>
          <McpBoard />
        </TabsContent>
        <TabsContent value="guide" className="mt-5">
          <McpGuide />
        </TabsContent>
      </Tabs>
    </ToolPage>
  );
}
