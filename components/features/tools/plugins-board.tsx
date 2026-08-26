"use client";

import * as React from "react";
import { Check, Download, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { pluginsMock } from "@/lib/data/tools";
import { useDemoState } from "@/stores/demo-state";
import { toast } from "@/stores/toast";
import { cn } from "@/lib/utils";

/** 插件市场 —— 搜索 + 卡片列表,安装/已安装状态本地持久化 */
export function PluginsBoard() {
  const [query, setQuery] = React.useState("");
  const [onlyInstalled, setOnlyInstalled] = React.useState(false);
  const pluginInstalled = useDemoState((s) => s.pluginInstalled);
  const togglePlugin = useDemoState((s) => s.togglePlugin);

  const installedCount = pluginsMock.filter((p) => pluginInstalled[p.id]).length;

  const filtered = pluginsMock.filter((p) => {
    if (onlyInstalled && !pluginInstalled[p.id]) return false;
    const q = query.trim().toLowerCase();
    return !q || `${p.name} ${p.description} ${p.author}`.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <Input
            placeholder="搜索插件…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <button
          type="button"
          aria-pressed={onlyInstalled}
          onClick={() => setOnlyInstalled((v) => !v)}
          className={cn(
            "h-8 cursor-pointer rounded-full px-3.5 text-xs transition-colors",
            onlyInstalled
              ? "bg-primary font-medium text-white"
              : "bg-chip text-muted hover:text-ink-2",
          )}
        >
          已安装({installedCount})
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {filtered.map((plugin, i) => {
          const installed = !!pluginInstalled[plugin.id];
          return (
            <article
              key={plugin.id}
              className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both flex items-start gap-4 rounded-xl border border-line bg-card p-4 duration-300"
              style={{ animationDelay: `${Math.min(i * 30, 240)}ms` }}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold text-ink">{plugin.name}</p>
                  <span className="shrink-0 rounded-full bg-chip px-2 py-0.5 text-[10px] text-muted">
                    {plugin.installs} 安装
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted">
                  {plugin.description}
                </p>
                <p className="mt-1.5 text-[11px] text-faint">{plugin.author}</p>
              </div>
              <Button
                variant={installed ? "soft" : "outline"}
                size="sm"
                className="shrink-0 rounded-full px-3"
                onClick={() => {
                  togglePlugin(plugin.id);
                  if (!installed) toast.success(`已安装「${plugin.name}」`);
                  else toast.info(`已卸载「${plugin.name}」`);
                }}
              >
                {installed ? (
                  <>
                    <Check className="size-3.5" />
                    已安装
                  </>
                ) : (
                  <>
                    <Download className="size-3.5" />
                    安装
                  </>
                )}
              </Button>
            </article>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="rounded-2xl bg-card p-10 text-center text-sm text-faint shadow-card">
          没有匹配的插件
        </div>
      )}
    </div>
  );
}
