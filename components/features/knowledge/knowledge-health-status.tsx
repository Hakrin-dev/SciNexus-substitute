"use client";

import { useKnowledgeHealth } from "@/lib/api/services";

/** 轻量知识底座状态，独立于各业务域的 mock 回退提示。 */
export function KnowledgeHealthStatus() {
  const { data, isLoading, isError } = useKnowledgeHealth();
  if (isLoading) return <span className="text-xs text-faint">正在检查知识底座…</span>;
  if (isError || !data) return <span className="text-xs text-amber-700">知识底座状态暂不可用</span>;
  const ready = data.status === "ready";
  return (
    <span className={ready ? "text-xs text-emerald-700" : "text-xs text-amber-700"} title={`检查耗时 ${data.tookMs}ms`}>
      <span className={`mr-1 inline-block size-1.5 rounded-full ${ready ? "bg-emerald-500" : "bg-amber-500"}`} />
      {ready ? "知识底座已连接" : "知识底座不可用"} · {data.provider}
    </span>
  );
}
