"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AtSign, Highlighter, Network, Plus, StickyNote } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFeedPapers } from "@/lib/api/services";
import {
  additionalLinks,
  relatedAuthors,
  similarPapers,
} from "@/lib/data/paper-detail";
import { cn } from "@/lib/utils";

/** 右侧面板 —— Assistant / 笔记 / 相关(对应原型热区面板切换) */
export function PaperRightPanel({ paperId }: { paperId?: string }) {
  const { data: feedPapers = [] } = useFeedPapers();

  // 相似论文:当前论文之外、同方向(tag)优先,库内真实数据;无匹配时回退演示列表
  const related = useMemo(() => {
    if (!paperId) return similarPapers.map((p) => ({ title: p.title, meta: p.meta, href: `/papers/${paperId ?? ""}` }));
    const current = feedPapers.find((p) => p.id === paperId);
    const tags = new Set(current?.tags ?? []);
    const scored = feedPapers
      .filter((p) => p.id !== paperId)
      .map((p) => ({
        title: p.title,
        meta: `${p.venue} · ${p.date}`.replace(/ · $/, ""),
        href: `/papers/${p.id}`,
        score:
          p.tags.filter((t) => tags.has(t)).length * 2 +
          (current && p.venue === current.venue ? 1 : 0),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
    return scored.length
      ? scored
      : similarPapers.map((p) => ({ title: p.title, meta: p.meta, href: "/papers/rdt-1b" }));
  }, [paperId, feedPapers]);

  return (
    <aside className="hidden w-80 shrink-0 flex-col border-l border-line bg-card lg:flex">
      <Tabs defaultValue="assistant" className="flex h-full flex-col">
        <TabsList className="shrink-0 gap-2 border-b border-line px-4 py-3">
          {[
            { value: "assistant", label: "Assistant" },
            { value: "notes", label: "笔记" },
            { value: "similar", label: "相关" },
          ].map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="rounded-md border border-transparent px-3 py-1.5 text-[13px] data-[state=active]:border-primary data-[state=active]:text-primary"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Assistant */}
        <TabsContent value="assistant" className="flex-1 space-y-4 overflow-y-auto p-4">
          <div className="rounded-xl border border-line p-3.5">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary-soft">
                <Highlighter className="size-4 text-primary" />
              </span>
              <div>
                <p className="text-[13px] font-semibold text-ink">Highlight & Ask</p>
                <p className="text-xs text-faint">选中任何段落以提问具体问题</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-line p-3.5">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary-soft">
                <AtSign className="size-4 text-primary" />
              </span>
              <div>
                <p className="text-[13px] font-semibold text-ink">Add Context</p>
                <p className="text-xs text-faint">使用 @ 引用其他论文以扩展讨论</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-line p-3.5">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-lg bg-ink">
                <Plus className="size-4 text-white" />
              </span>
              <p className="text-[13px] font-semibold text-ink">Additional</p>
            </div>
            <ul className="mt-2.5 space-y-1.5 pl-1.5">
              {additionalLinks.map((link) => (
                <li
                  key={link}
                  className="flex cursor-pointer items-center gap-2 text-[13px] text-muted transition-colors hover:text-primary"
                >
                  <span className="size-1 rounded-full bg-current opacity-50" />
                  {link}
                </li>
              ))}
            </ul>
          </div>

          <p className="px-1 text-xs text-faint">
            尝试提问:3.2 节的核心直觉是什么?
          </p>

          <div className="rounded-xl border border-line bg-panel px-3.5 py-2.5">
            <input
              placeholder="询问关于此论文的任意问题…"
              className="w-full bg-transparent text-[13px] text-ink outline-none placeholder:text-faint"
            />
          </div>
        </TabsContent>

        {/* 笔记 */}
        <TabsContent value="notes" className="flex-1 p-4">
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-chip">
              <StickyNote className="size-5 text-faint" />
            </span>
            <p className="text-[13px] text-muted">暂无笔记</p>
            <p className="max-w-[200px] text-xs text-faint">
              选中正文段落即可添加高亮与标注,标注会同步到这里
            </p>
          </div>
        </TabsContent>

        {/* 相关 —— 对应 prototype_v1.html 的 相关 覆盖面板 */}
        <TabsContent value="similar" className="flex-1 space-y-5 overflow-y-auto p-4">
          <section>
            <h3 className="border-b border-chip pb-2 text-[13px] font-semibold text-ink">
              相似论文
            </h3>
            <div className="mt-2.5 space-y-2">
              {related.map((paper) => (
                <Link
                  key={paper.title}
                  href={paper.href}
                  className="block rounded-lg bg-panel p-3 transition-colors hover:bg-primary-soft"
                >
                  <p className="text-xs font-medium leading-relaxed text-ink-2">
                    {paper.title}
                  </p>
                  <p className="mt-1 text-[11px] text-faint">{paper.meta}</p>
                </Link>
              ))}
            </div>
          </section>

          <section>
            <h3 className="border-b border-chip pb-2 text-[13px] font-semibold text-ink">
              领域相关作者
            </h3>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {relatedAuthors.map((author) => {
                const cls = cn(
                  "rounded-full bg-chip px-3 py-1 text-xs text-ink-2 transition-colors",
                  author.scholarId && "hover:bg-primary-soft hover:text-primary",
                );
                return author.scholarId ? (
                  <Link key={author.name} href={`/scholars/${author.scholarId}`} className={cls}>
                    {author.name}
                  </Link>
                ) : (
                  <span key={author.name} className={cls}>
                    {author.name}
                  </span>
                );
              })}
            </div>
          </section>

          <section>
            <h3 className="border-b border-chip pb-2 text-[13px] font-semibold text-ink">
              知识图谱
            </h3>
            <Link
              href={`/papers/${encodeURIComponent(paperId ?? "")}/graph`}
              className="mt-2.5 flex items-center gap-3 rounded-lg bg-panel p-3 transition-colors hover:bg-primary-soft"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft">
                <Network className="size-4.5 text-primary" />
              </span>
              <span>
                <span className="block text-xs font-medium text-ink-2">
                  公域引用关系图谱
                </span>
                <span className="mt-0.5 block text-[11px] text-faint">
                  打开当前论文的真实引用关系图谱 →
                </span>
              </span>
            </Link>
          </section>
        </TabsContent>
      </Tabs>
    </aside>
  );
}
