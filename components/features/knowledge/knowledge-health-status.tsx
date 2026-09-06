"use client";

import { useKnowledgeHealth, useRetryKnowledgeHealth } from "@/lib/api/services";

/** 轻量知识底座状态，独立于各业务域的 mock 回退提示。 */
export function KnowledgeHealthStatus() {
  const { data, isLoading, isError } = useKnowledgeHealth();
  const retry = useRetryKnowledgeHealth();
  if (isLoading) return <span className="text-xs text-faint">正在检查知识底座…</span>;
  if (isError || !data) return <span className="text-xs text-amber-700">知识底座状态暂不可用</span>;
  const ready = data.status === "ready";
  const degraded = data.status === "degraded";
  const failures = Object.values(data.checks).filter((check) => !check.ok).map((check) => check.error?.message).filter(Boolean);
  const label = ready ? "知识底座已连接" : degraded ? "知识底座部分可用" : "知识底座暂不可用";
  return (
    <span className={ready ? "inline-flex items-center text-xs text-emerald-700" : "inline-flex items-center gap-1.5 text-xs text-amber-700"} title={`${failures.join("；") || "检查正常"} · 耗时 ${data.tookMs}ms`}>
      <span className={`inline-block size-1.5 rounded-full ${ready ? "bg-emerald-500" : "bg-amber-500"}`} />
      {label} · {data.provider}
      {!ready && (
        <button type="button" onClick={() => retry.mutate()} disabled={retry.isPending} className="ml-1 underline decoration-amber-400 underline-offset-2 hover:text-primary disabled:opacity-50">
          {retry.isPending ? "重试中…" : "立即重试"}
        </button>
      )}
    </span>
  );
}
