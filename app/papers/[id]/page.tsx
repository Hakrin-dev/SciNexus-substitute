"use client";

import { useParams } from "next/navigation";
import { PaperTopbar } from "@/components/features/paper/paper-topbar";
import { PaperLeftSidebar } from "@/components/features/paper/paper-left-sidebar";
import { PaperRightPanel } from "@/components/features/paper/right-panel";
import { PaperZoom } from "@/components/features/paper/paper-zoom";
import { usePaperDetail } from "@/lib/api/services";

/**
 * 论文详情页 `/papers/[id]` —— 对应「深知-论文详情页.svg」
 * 沉浸式阅读器布局(不使用全局侧边栏)；数据来自后端 /api/papers/{id}，失败回退 mock。
 */
export default function PaperDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id ?? "";
  const { data: paper } = usePaperDetail(id);

  if (!paper) return null;

  return (
    <div className="flex h-screen flex-col bg-background">
      <PaperTopbar paperId={paper.id} title={paper.title} likes={paper.likes} />

      <div className="flex min-h-0 flex-1">
        <PaperLeftSidebar
          toc={paper.toc}
          current={paper.page.current}
          total={paper.page.total}
        />

        {/* 正文:整页等比缩放,宽度随侧栏展开/收起填满可用空间 */}
        <main className="min-w-0 flex-1 overflow-y-auto px-8 py-8">
          <PaperZoom>
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

            <h2 id="intro" className="mt-8 text-[17px] font-bold text-ink">
              1. Introduction
            </h2>
            <p className="mt-3 text-justify text-[15px] leading-7 text-ink-2">
              {paper.introduction}
            </p>

            <figure className="mt-6">
              <figcaption className="py-2 text-center text-xs text-faint">
                Figure 1
              </figcaption>
              <div className="h-72 rounded-xl bg-panel" />
            </figure>
            </article>
          </PaperZoom>
        </main>

        <PaperRightPanel />
      </div>
    </div>
  );
}
