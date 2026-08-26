"use client";

import * as React from "react";
import { Check, ChevronDown, Copy, Plus, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDemoState } from "@/stores/demo-state";
import { copyText, toast } from "@/stores/toast";
import { cn } from "@/lib/utils";

/** MCP 服务器管理 —— 连接状态 / 环境变量掩码 / 新增服务器 / 配置 JSON */
export function McpBoard() {
  const servers = useDemoState((s) => s.mcpServers);
  const toggleConnected = useDemoState((s) => s.toggleMcpConnected);
  const addMcpServer = useDemoState((s) => s.addMcpServer);

  const [adding, setAdding] = React.useState(false);
  const [name, setName] = React.useState("");
  const [command, setCommand] = React.useState("");
  const [envRaw, setEnvRaw] = React.useState("");
  const [openJson, setOpenJson] = React.useState<string | null>(null);
  /** 复制成功后短暂显示对勾 */
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const handleCopyConfig = async (server: { id: string; configJson: string }) => {
    const okFlag = await copyText(server.configJson, "配置 JSON 已复制");
    if (okFlag) {
      setCopiedId(server.id);
      window.setTimeout(() => setCopiedId((cur) => (cur === server.id ? null : cur)), 1500);
    }
  };

  const connectedCount = servers.filter((m) => m.connected).length;

  const handleAdd = () => {
    if (!name.trim() || !command.trim()) {
      toast.error("请填写名称与启动命令");
      return;
    }
    addMcpServer({
      name: name.trim(),
      command: command.trim(),
      tools: 0,
      connected: false,
      envKeys: envRaw
        .split(/[,，]/)
        .map((k) => k.trim())
        .filter(Boolean),
      configJson: `{\n  "mcpServers": {\n    "${name.trim()}": {\n      "command": "${command.trim()}"\n    }\n  }\n}`,
    });
    setName("");
    setCommand("");
    setEnvRaw("");
    setAdding(false);
    toast.success("服务器已添加(未连接)");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-faint">
          已连接 <span className="font-medium text-ink-2">{connectedCount}</span> / {servers.length} 台 ·
          工具将由对话自动调用
        </p>
        <Button
          variant={adding ? "soft" : "outline"}
          size="sm"
          className="rounded-full"
          onClick={() => setAdding((v) => !v)}
        >
          <Plus className="size-3.5" />
          添加服务器
        </Button>
      </div>

      {/* 行内新增表单 */}
      {adding && (
        <div className="animate-in fade-in slide-in-from-bottom-2 space-y-3 rounded-xl border border-line bg-card p-4 shadow-card duration-300">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-ink-2">名称</span>
              <Input placeholder="如:Web Search" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-ink-2">启动命令</span>
              <Input
                placeholder="npx -y some-mcp-server"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                className="font-mono text-[13px]"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-ink-2">
              环境变量名<span className="ml-1 font-normal text-faint">(可选,逗号分隔,值不会展示)</span>
            </span>
            <Input placeholder="API_KEY, BASE_URL" value={envRaw} onChange={(e) => setEnvRaw(e.target.value)} />
          </label>
          <div className="flex justify-end">
            <Button size="sm" onClick={handleAdd}>
              保存
            </Button>
          </div>
        </div>
      )}

      {/* 服务器列表 */}
      <div className="space-y-3">
        {servers.map((server, i) => (
          <article
            key={server.id}
            className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both rounded-xl border border-line bg-card p-4 duration-300"
            style={{ animationDelay: `${Math.min(i * 30, 240)}ms` }}
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft">
                <Server className="size-4 text-primary" />
              </span>
              <span className="text-sm font-semibold text-ink">{server.name}</span>

              {/* 连接状态灯 */}
              <span className="flex items-center gap-1.5 text-[11px]">
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    server.connected ? "bg-success" : "bg-faint",
                  )}
                />
                <span className={server.connected ? "text-success" : "text-faint"}>
                  {server.connected ? "已连接" : "未连接"}
                </span>
              </span>
              <span className="rounded-full bg-chip px-2 py-0.5 text-[10px] text-muted">
                {server.tools} 个工具
              </span>

              <div className="ml-auto flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 rounded-full px-3 text-xs"
                  onClick={() => {
                    toggleConnected(server.id);
                    toast.success(
                      server.connected ? `已断开「${server.name}」` : `已连接「${server.name}」`,
                    );
                  }}
                >
                  {server.connected ? "断开" : "连接"}
                </Button>
                <button
                  type="button"
                  aria-expanded={openJson === server.id}
                  title="查看配置 JSON"
                  onClick={() => setOpenJson(openJson === server.id ? null : server.id)}
                  className="cursor-pointer rounded-lg p-1.5 text-faint transition-colors hover:bg-chip hover:text-ink"
                >
                  <ChevronDown
                    className={cn("size-4 transition-transform", openJson === server.id && "rotate-180")}
                  />
                </button>
              </div>
            </div>

            <p className="mt-2 truncate rounded-lg bg-panel px-3 py-1.5 font-mono text-[12px] text-muted">
              {server.command}
            </p>

            {server.envKeys.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-faint">环境变量:</span>
                {server.envKeys.map((key) => (
                  <span
                    key={key}
                    className="rounded bg-chip px-1.5 py-0.5 font-mono text-[10px] text-muted"
                  >
                    {key}=***
                  </span>
                ))}
              </div>
            )}

            {/* 展开 JSON */}
            {openJson === server.id && (
              <div className="animate-in fade-in slide-in-from-bottom-1 mt-3 duration-200">
                <div className="relative">
                  <pre className="overflow-x-auto rounded-lg bg-sidebar p-3 font-mono text-[11px] leading-relaxed text-ink-2">
                    {server.configJson}
                  </pre>
                  <button
                    type="button"
                    title="复制配置"
                    onClick={() => void handleCopyConfig(server)}
                    className="absolute right-2 top-2 cursor-pointer rounded-md bg-card p-1.5 text-faint shadow-sm transition-colors hover:text-primary"
                  >
                    {copiedId === server.id ? (
                      <Check className="size-3.5 text-success" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                  </button>
                </div>
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
