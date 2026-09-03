"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Beaker, FileCode2, FileText, FolderArchive } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { apiGet } from "@/lib/api/client";
import type { WorkbenchAsset } from "@/lib/data/workbench";

const metadataLabel: Record<string, string> = {
  stage: "研究阶段",
  relativePath: "产物路径",
  size: "文件大小",
  sha256: "SHA-256",
  producer: "生成器",
};

export default function AssetDetailPage() {
  const { id = "", assetId = "" } = useParams<{ id: string; assetId: string }>();
  const router = useRouter();
  const [asset, setAsset] = useState<WorkbenchAsset | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiGet<WorkbenchAsset>(`/api/projects/${id}/assets/${encodeURIComponent(assetId)}`)
      .then((response) => active && setAsset(response.data ?? null))
      .catch((reason: unknown) => active && setError(reason instanceof Error ? reason.message : "资产加载失败"));
    return () => { active = false; };
  }, [id, assetId]);

  const artifact = asset?.artifact;
  return (
    <AppShell>
      <main className="mx-auto max-w-5xl px-6 py-8 lg:px-10">
        <button onClick={() => router.push(`/projects/${id}?view=assets`)} className="flex items-center gap-1.5 text-sm text-muted hover:text-primary">
          <ArrowLeft className="size-4" />返回资产库
        </button>

        {error && <div className="mt-6 rounded-xl border border-danger/20 bg-danger/5 p-5 text-sm text-danger">{error}</div>}
        {!asset && !error && <div className="mt-6 rounded-xl bg-card p-8 text-sm text-muted shadow-card">正在加载资产详情…</div>}

        {asset && (
          <div className="mt-5 space-y-5">
            <header className="rounded-2xl bg-card p-6 shadow-card">
              <div className="flex items-start gap-4">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  {asset.kind === "experiment" ? <Beaker className="size-5" /> : artifact?.kind === "code" ? <FileCode2 className="size-5" /> : <FileText className="size-5" />}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="break-all text-xl font-bold text-ink">{asset.title}</h1>
                    <span className="rounded-full bg-chip px-2.5 py-1 text-[11px] text-muted">{artifact?.kind ?? asset.kind}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted">{asset.meta}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">{asset.tags.map((tag) => <span key={tag} className="rounded-full bg-primary-soft px-2.5 py-1 text-[11px] text-primary">#{tag}</span>)}</div>
                </div>
              </div>
            </header>

            <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
              <article className="min-w-0 rounded-2xl bg-card p-6 shadow-card">
                <h2 className="flex items-center gap-2 text-sm font-bold text-ink"><FileText className="size-4 text-primary" />产物内容</h2>
                {artifact?.content ? (
                  <pre className="mt-4 max-h-[65vh] overflow-auto whitespace-pre-wrap break-words rounded-xl bg-panel p-4 font-mono text-xs leading-6 text-ink-2">{artifact.content}</pre>
                ) : (
                  <div className="mt-4 rounded-xl bg-panel p-8 text-center text-sm text-muted">该产物是二进制文件或超过在线预览大小限制，可根据右侧产物路径在运行目录中查看。</div>
                )}
              </article>

              <aside className="rounded-2xl bg-card p-5 shadow-card">
                <h2 className="flex items-center gap-2 text-sm font-bold text-ink"><FolderArchive className="size-4 text-primary" />产物信息</h2>
                <dl className="mt-4 space-y-3 text-xs">
                  {artifact?.runId && <Meta label="运行 ID" value={artifact.runId} />}
                  {artifact?.uri && <Meta label="内部 URI" value={artifact.uri} />}
                  {artifact && Object.entries(artifact.metadata).map(([key, value]) => <Meta key={key} label={metadataLabel[key] ?? key} value={typeof value === "string" ? value : JSON.stringify(value)} />)}
                </dl>
              </aside>
            </section>
          </div>
        )}
      </main>
    </AppShell>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-faint">{label}</dt><dd className="mt-1 break-all text-ink-2">{value}</dd></div>;
}
