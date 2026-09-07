"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PaperTopbar } from "@/components/features/paper/paper-topbar";
import { PaperLeftSidebar } from "@/components/features/paper/paper-left-sidebar";
import { PaperRightPanel } from "@/components/features/paper/right-panel";
import { PaperZoom } from "@/components/features/paper/paper-zoom";
import { usePaperDetail } from "@/lib/api/services";
import { useRecentViews } from "@/stores/recent-views";

function PdfReader({
  paperId,
  title,
  source,
  pdfUrl,
}: {
  paperId: string;
  title: string;
  source?: string;
  pdfUrl: string;
}) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const proxyUrl = `/api/papers/${encodeURIComponent(paperId)}/pdf?inline=1${source === "remote_knowledge_base" ? `&source=remote_knowledge_base&title=${encodeURIComponent(title)}` : ""}`;

  useEffect(() => {
    const controller = new AbortController();
    let createdUrl: string | null = null;
    setState("loading");
    setObjectUrl(null);
    fetch(proxyUrl, { headers: { Accept: "application/pdf" }, signal: controller.signal })
      .then((response) => {
        const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
        if (!response.ok || !contentType.includes("application/pdf")) throw new Error("PDF proxy response is not a PDF");
        return response.blob();
      })
      .then((blob) => {
        createdUrl = URL.createObjectURL(blob);
        setObjectUrl(createdUrl);
        setState("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState("error");
      });
    return () => {
      controller.abort();
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [proxyUrl]);

  if (state === "loading") {
    return <div className="grid h-full min-h-[calc(100vh-6rem)] place-items-center text-sm text-muted">正在加载论文 PDF…</div>;
  }
  if (state === "error" || !objectUrl) {
    return (
      <div className="flex h-full min-h-[calc(100vh-6rem)] flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-muted">服务端 PDF 代理暂时无法读取该文件，未将错误响应当作论文正文展示。</p>
        <a href={pdfUrl} target="_blank" rel="noreferrer" className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90">
          尝试在浏览器中打开原始 PDF
        </a>
      </div>
    );
  }

  return <iframe src={objectUrl} title={`${title} PDF`} className="h-full min-h-[calc(100vh-6rem)] w-full border-0" />;
}

/**
 * 论文阅读器 `/papers/[id]` 的客户端交互体 —— 对应「深知-论文详情页.svg」
 * 沉浸式阅读器布局(不使用全局侧边栏)；数据来自后端 /api/papers/{id}，失败回退 mock。
 * 由同目录 server 壳 page.tsx 提供 id 与元信息。
 */
export function PaperReaderView({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const source = searchParams.get("source") === "remote_knowledge_base" ? "remote_knowledge_base" : undefined;
  const titleHint = searchParams.get("title") ?? undefined;
  const { data: paper, isLoading, isError, error } = usePaperDetail(id, source, titleHint);
  const record = useRecentViews((s) => s.record);

  // 浏览记录埋点(本地持久化)
  useEffect(() => {
    if (paper?.title) {
      record({ kind: "paper", id: paper.id, title: paper.title, subtitle: paper.affiliation });
    }
  }, [paper?.id, paper?.title, paper?.affiliation, record]);

  if (isLoading && !paper) {
    return <main className="grid min-h-screen place-items-center text-sm text-muted">正在读取论文信息…</main>;
  }
  if (isError && !paper) {
    return (
      <main className="grid min-h-screen place-items-center px-6 text-center">
        <div>
          <h1 className="text-lg font-semibold text-ink">论文信息暂时不可用</h1>
          <p className="mt-2 text-sm text-muted">{error instanceof Error ? error.message : "请稍后重试。"}</p>
          <Link href="/" className="mt-4 inline-block text-sm text-primary hover:underline">返回发现页</Link>
        </div>
      </main>
    );
  }
  if (!paper) return null;

  return (
    <div className="flex h-screen flex-col bg-background">
      <PaperTopbar paperId={paper.id} title={paper.title} likes={paper.likes} pdfUrl={paper.pdfUrl} source={paper.source} />

      <div className="flex min-h-0 flex-1">
        <PaperLeftSidebar
          toc={paper.toc}
          current={paper.page.current}
          total={paper.page.total}
        />

        {/* 正文:整页等比缩放,宽度随侧栏展开/收起填满可用空间 */}
        <main className="min-w-0 flex-1 overflow-y-auto px-8 py-8">
          {paper.readingState === "pdf" ? (
            <div className="h-full min-h-[calc(100vh-6rem)] overflow-hidden rounded-2xl bg-card shadow-card">
              <PdfReader paperId={paper.id} title={paper.title} source={paper.source} pdfUrl={paper.pdfUrl!} />
            </div>
          ) : <PaperZoom>
            <article className="rounded-2xl bg-card p-10 shadow-card">
            <h1 className="text-center text-[22px] font-bold leading-snug text-ink">
              {paper.title}
            </h1>
            <p className="mt-4 text-center text-sm leading-relaxed text-muted">
              {paper.authors.join(", ")}
            </p>
            <p className="mt-1.5 text-center text-xs text-faint">
              {paper.affiliation}
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2 text-xs">
              <span className="rounded-full bg-primary-soft px-2.5 py-1 text-primary">
                {paper.source === "remote_knowledge_base" ? "远程知识底座" : "本地论文库"}
              </span>
              {paper.fallbackUsed && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-800">已回退本地数据</span>}
              <Link href={`/papers/${encodeURIComponent(paper.id)}/graph`} className="rounded-full bg-chip px-2.5 py-1 text-ink-2 hover:text-primary">
                查看引用图谱
              </Link>
              {paper.pdfUrl && <a href={`/api/papers/${encodeURIComponent(paper.id)}/pdf?inline=1${paper.source === "remote_knowledge_base" ? `&source=remote_knowledge_base&title=${encodeURIComponent(paper.title)}` : ""}`} target="_blank" rel="noreferrer" className="rounded-full bg-chip px-2.5 py-1 text-ink-2 hover:text-primary">在新窗口打开 PDF</a>}
            </div>

            <hr className="mx-auto mt-6 w-16 border-line" />

            <h2
              id="abstract"
              className="mt-8 text-[17px] font-bold text-ink"
            >
              Abstract
            </h2>
            <p className="mt-3 text-justify text-[15px] leading-7 text-ink-2">
              {paper.abstract}
            </p>

            {paper.hasFulltext ? (
              <>
                <h2 id="intro" className="mt-8 text-[17px] font-bold text-ink">论文全文</h2>
                <div className="mt-3 space-y-5">
                  {(paper.fulltextChunks ?? []).map((chunk: { page: number; text: string }, index: number) => (
                    <section key={`${chunk.page}-${index}`}>
                      <p className="mb-1 text-[11px] text-faint">第 {chunk.page} 页</p>
                      <p className="text-justify text-[15px] leading-7 text-ink-2">{chunk.text}</p>
                    </section>
                  ))}
                </div>
              </>
            ) : (
              <div className="mt-8 rounded-xl border border-line bg-panel p-4 text-sm text-muted">
                当前仅获得论文元数据和摘要，尚未取得可验证的全文或 PDF；因此不会把摘要伪装成完整章节。
              </div>
            )}
            </article>
          </PaperZoom>}
        </main>

        <PaperRightPanel paperId={paper.id} />
      </div>
    </div>
  );
}
