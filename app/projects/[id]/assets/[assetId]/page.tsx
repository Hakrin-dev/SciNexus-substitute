"use client";
import Link from "next/link";
import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileText } from "lucide-react";
import { apiGet } from "@/lib/api/client";
import type { WorkbenchAsset } from "@/lib/data/workbench";

export default function AssetDetailPage({ params }: { params: Promise<{ id: string; assetId: string }> }) {
  const { id, assetId } = use(params);
  const query = useQuery({ queryKey: ["api", "project", id, "asset", assetId], queryFn: async () => (await apiGet<WorkbenchAsset>(`/api/projects/${id}/assets/${assetId}`)).data });
  return <main className="mx-auto min-h-screen max-w-5xl px-6 py-10">
    <Link href={`/projects/${id}?view=assets`} className="inline-flex items-center gap-2 text-sm text-muted"><ArrowLeft className="size-4"/>返回资产库</Link>
    {query.isLoading && <p className="mt-10 text-muted">正在加载资产…</p>}
    {query.isError && <div className="mt-10 rounded-xl border border-danger/30 p-5 text-danger">{query.error.message}</div>}
    {query.data && <article className="mt-6 rounded-2xl border border-line bg-card p-8 shadow-card">
      <div className="flex items-start gap-3"><FileText className="mt-1 size-5 text-primary"/><div><p className="text-xs text-muted">{query.data.artifact?.stage || query.data.kind} · {query.data.status}</p><h1 className="mt-1 text-2xl font-bold text-ink">{query.data.title}</h1></div></div>
      <div className="mt-5 flex flex-wrap gap-2">{query.data.tags.map(tag=><span key={tag} className="rounded-full bg-chip px-3 py-1 text-xs">{tag}</span>)}</div>
      <p className="mt-6 text-sm text-muted">{query.data.meta}</p>
      <pre className="mt-6 whitespace-pre-wrap rounded-xl bg-panel p-5 font-sans text-sm leading-7 text-ink">{query.data.artifact?.content || "该资产暂无正文内容。"}</pre>
    </article>}
  </main>;
}
