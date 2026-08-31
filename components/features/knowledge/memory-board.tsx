"use client";

import * as React from "react";
import { Brain, FolderKanban, Globe2, Sparkles, Trash2 } from "lucide-react";
import {
  useDeleteMemoryEntry,
  useMemory,
  useToggleMemoryEntry,
} from "@/lib/api/services";
import { toast } from "@/stores/toast";
import { cn } from "@/lib/utils";

function formatDay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${Number(m[2])}月${Number(m[3])}日` : iso;
}

type ScopeFilter = "all" | "global" | "project";

const SCOPE_FILTERS: { value: ScopeFilter; label: string; icon: typeof Globe2 }[] = [
  { value: "all", label: "全部", icon: Brain },
  { value: "global", label: "全局级", icon: Globe2 },
  { value: "project", label: "项目级", icon: FolderKanban },
];

/**
 * 知识库·AI 记忆 —— 全局级/项目级记忆条目管理。
 * 登录后走真实接口(GET /api/memory,SQLite 持久化,重启不丢);
 * 未登录/后端不可达时回退本地演示态(demo-state)。
 */
export function MemoryBoard() {
  const { data } = useMemory();
  const toggleEntry = useToggleMemoryEntry();
  const deleteEntry = useDeleteMemoryEntry();
  const { enabled: memoryEnabled, items: memoryEntries } = data;

  const [scope, setScope] = React.useState<ScopeFilter>("all");

  const filtered = memoryEntries.filter((m) => scope === "all" || m.scope === scope);
  const activeCount = memoryEntries.filter((m) => m.enabled).length;
  const globalCount = memoryEntries.filter((m) => m.scope === "global").length;
  const projectCount = memoryEntries.length - globalCount;

  return (
    <div className="space-y-4">
      {/* 作用域筛选 */}
      <div className="flex flex-wrap items-center gap-2">
        {SCOPE_FILTERS.map((f) => {
          const count =
            f.value === "all"
              ? memoryEntries.length
              : f.value === "global"
                ? globalCount
                : projectCount;
          return (
            <button
              key={f.value}
              type="button"
              aria-pressed={scope === f.value}
              onClick={() => setScope(f.value)}
              className={cn(
                "flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-xs transition-colors",
                scope === f.value
                  ? "bg-primary font-medium text-white"
                  : "bg-chip text-muted hover:text-ink-2",
              )}
            >
              <f.icon className="size-3.5" />
              {f.label}
              <span className={cn("tabular-nums", scope === f.value ? "text-white/80" : "text-faint")}>
                {count}
              </span>
            </button>
          );
        })}
        <span className="ml-auto text-xs text-faint">
          生效 {activeCount}/{memoryEntries.length}
        </span>
      </div>

      {/* 条目列表 */}
      <div className="space-y-3">
        {filtered.map((entry, i) => {
          const off = !entry.enabled;
          const dimmed = off || !memoryEnabled;
          return (
            <article
              key={entry.id}
              className={cn(
                "animate-in fade-in slide-in-from-bottom-2 fill-mode-both flex items-start gap-3.5 rounded-xl border border-line bg-card p-4 duration-300",
                dimmed && "opacity-55",
              )}
              style={{ animationDelay: `${Math.min(i * 30, 240)}ms` }}
            >
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary-soft">
                <Sparkles className={cn("size-3.5", dimmed ? "text-faint" : "text-primary")} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] leading-relaxed text-ink-2">{entry.fact}</p>
                <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-faint">
                  {/* 作用域徽章 */}
                  {entry.scope === "project" ? (
                    <span className="flex items-center gap-1 rounded bg-brand-blue-soft px-1.5 py-0.5 font-medium text-brand-blue">
                      <FolderKanban className="size-3" />
                      {entry.project || "项目"} · 项目级
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 rounded bg-chip px-1.5 py-0.5 font-medium text-muted">
                      <Globe2 className="size-3" />
                      全局级
                    </span>
                  )}
                  <span>来源:{entry.source}</span>
                  <span>·</span>
                  <span>{formatDay(entry.createdAt)}</span>
                </p>
              </div>
              {/* 单条开关 */}
              <button
                type="button"
                role="switch"
                aria-checked={!off}
                aria-label={off ? "启用该记忆" : "停用该记忆"}
                disabled={!memoryEnabled || toggleEntry.isPending}
                onClick={() => toggleEntry.mutate(entry.id)}
                className={cn(
                  "relative h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors",
                  !off && memoryEnabled ? "bg-primary" : "bg-line",
                  !memoryEnabled && "cursor-not-allowed",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 size-4 rounded-full bg-white shadow transition-all",
                    !off && memoryEnabled ? "left-[18px]" : "left-0.5",
                  )}
                />
              </button>
              <button
                type="button"
                aria-label="删除该记忆"
                disabled={deleteEntry.isPending}
                onClick={() => {
                  deleteEntry.mutate(entry.id);
                  toast.info("已删除该条记忆");
                }}
                className="shrink-0 cursor-pointer rounded-md p-1.5 text-faint transition-colors hover:bg-chip hover:text-danger"
              >
                <Trash2 className="size-3.5" />
              </button>
            </article>
          );
        })}
        {filtered.length === 0 && (
          <div className="rounded-2xl bg-card p-12 text-center shadow-card">
            <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-chip">
              <Brain className="size-5 text-faint" />
            </span>
            <p className="mt-3 text-sm text-muted">
              {scope === "project" ? "暂无项目级记忆" : scope === "global" ? "暂无全局级记忆" : "暂无记忆"}
            </p>
            <p className="mt-1 text-xs text-faint">与 AI 对话时它会自动积累关于你的偏好</p>
          </div>
        )}
      </div>
    </div>
  );
}