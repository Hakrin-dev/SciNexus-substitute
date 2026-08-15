"use client";

import * as React from "react";
import { Bookmark, BookmarkCheck, Copy, Sparkles } from "lucide-react";
import { answerBlocks, agentReferences, agentSession } from "@/lib/data/agent";
import { withCitations } from "@/lib/citations";
import { CiteMenu } from "./cite-menu";
import { cn } from "@/lib/utils";
/** AI 深度研究回答卡片 —— 对应 AI 研究助手 SVG 的回答区 */
export function AnswerCard() {
  const { table } = answerBlocks;
  /** 演示:存入知识库 / 复制 的本地状态 */
  const [savedToLibrary, setSavedToLibrary] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const copyAnswer = async () => {
    try {
      await navigator.clipboard.writeText(
        [
          answerBlocks.intro,
          answerBlocks.methodBody,
          answerBlocks.industryBody,
          answerBlocks.conclusion,
        ].join("\n\n"),
      );
    } catch {
      // 剪贴板不可用时静默失败,仍展示已复制态做演示
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <article className="rounded-2xl bg-card p-6 shadow-card">
      {/* 头部 */}
      <div className="flex items-center gap-2.5 border-b border-line pb-4">
        <span className="flex size-8 items-center justify-center rounded-full bg-primary">
          <Sparkles className="size-4 text-white" />
        </span>
        <span className="text-sm font-semibold text-ink">研枢 AI · 深度研究</span>
        <span className="rounded bg-brand-violet px-1.5 py-0.5 text-[10px] font-bold text-white">
          Pro
        </span>
        <span className="text-xs text-faint">{agentSession.meta}</span>
      </div>

      <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-ink-2">
        <p>{withCitations(answerBlocks.intro)}</p>

        <h3 className="pt-1 text-[15px] font-bold text-ink">
          {answerBlocks.methodHeading}
        </h3>
        <p>{withCitations(answerBlocks.methodBody)}</p>

        {/* 性能对比表 */}
        <div>
          <p className="text-[13px] font-medium text-ink">
            {answerBlocks.tableCaption}
          </p>
          <div className="mt-2 overflow-hidden rounded-xl bg-panel px-5 py-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-faint">
                  {table.header.map((h) => (
                    <th key={h} className="py-2.5 font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, ri) => {
                  const highlighted = ri === table.highlightRow;
                  return (
                    <tr
                      key={row[0]}
                      className={cn(
                        highlighted && "font-semibold text-primary",
                      )}
                    >
                      <td className="py-2.5">
                        {withCitations(row[0])}
                        {highlighted && (
                          <span className="ml-1.5 text-xs">· 推荐</span>
                        )}
                      </td>
                      {row.slice(1).map((cell, ci) => (
                        <td key={ci} className="py-2.5">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <p>{withCitations(answerBlocks.industryBody)}</p>

        <h3 className="pt-1 text-[15px] font-bold text-ink">
          {answerBlocks.trendHeading}
        </h3>
        <ol className="space-y-2.5">
          {answerBlocks.trends.map((trend, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[11px] font-semibold text-primary">
                {i + 1}
              </span>
              <span>{withCitations(trend)}</span>
            </li>
          ))}
        </ol>

        <p>{withCitations(answerBlocks.conclusion)}</p>
      </div>

      {/* 操作栏:存入知识库 / 导出引用 / 复制 */}
      <div className="mt-5 flex items-center gap-2 border-t border-line pt-4">
        <button
          type="button"
          aria-pressed={savedToLibrary}
          onClick={() => setSavedToLibrary((v) => !v)}
          className={cn(
            "flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-colors",
            savedToLibrary
              ? "bg-primary-soft text-primary"
              : "text-muted hover:bg-chip hover:text-ink-2",
          )}
        >
          {savedToLibrary ? (
            <BookmarkCheck className="size-4" />
          ) : (
            <Bookmark className="size-4" />
          )}
          {savedToLibrary ? "已存入知识库" : "存入知识库"}
        </button>
        <div className="flex h-8 items-center rounded-lg px-3 transition-colors hover:bg-chip">
          <CiteMenu refs={agentReferences} />
        </div>
        <button
          type="button"
          onClick={copyAnswer}
          className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-muted transition-colors hover:bg-chip hover:text-ink-2"
        >
          <Copy className="size-4" />
          {copied ? "已复制" : "复制回答"}
        </button>
      </div>
    </article>
  );
}
