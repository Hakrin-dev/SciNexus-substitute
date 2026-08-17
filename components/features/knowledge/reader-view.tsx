"use client";

import * as React from "react";
import {
  FileText,
  Highlighter,
  Languages,
  Plus,
  ScanEye,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  readerAnnotations,
  readerFigures,
  readerPaper,
  readerSections,
} from "@/lib/data/reader";
import { cn } from "@/lib/utils";

type ViewMode = "bilingual" | "zh" | "en";

const VIEW_MODES: { value: ViewMode; label: string }[] = [
  { value: "bilingual", label: "对照" },
  { value: "zh", label: "仅译文" },
  { value: "en", label: "仅原文" },
];

interface Annotation {
  id: string;
  quote: string;
  note: string;
  createdAt: string;
}

/** 文献精读视图 —— 对照翻译 + AI 图表解释 + 批注(演示,数据见 lib/data/reader.ts) */
export function ReaderView() {
  const [mode, setMode] = React.useState<ViewMode>("bilingual");
  const [annotations, setAnnotations] =
    React.useState<Annotation[]>(readerAnnotations);
  const [draft, setDraft] = React.useState("");

  const addAnnotation = (quote: string, note: string) => {
    if (!note.trim()) return;
    setAnnotations((prev) => [
      {
        id: `a${Date.now()}`,
        quote,
        note: note.trim(),
        createdAt: "刚刚",
      },
      ...prev,
    ]);
  };

  return (
    <div className="mx-auto max-w-[1180px] px-8 py-6">
      {/* 头部:文件信息 + 视图切换 */}
      <header className="rounded-2xl bg-card p-6 shadow-card">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-danger-soft text-danger">
              <FileText className="size-6" />
            </span>
            <div>
              <h1 className="text-lg font-bold text-ink">
                {mode === "en" ? readerPaper.title : readerPaper.titleZh}
              </h1>
              {mode === "bilingual" && (
                <p className="mt-0.5 text-sm text-muted">{readerPaper.title}</p>
              )}
              <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-faint">
                <span>{readerPaper.meta}</span>
                <span className="flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 font-medium text-success">
                  <Sparkles className="size-3" />
                  {readerPaper.parseMeta}
                </span>
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1 rounded-full bg-sidebar p-1">
            {VIEW_MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                aria-pressed={mode === m.value}
                onClick={() => setMode(m.value)}
                className={cn(
                  "flex h-7 cursor-pointer items-center gap-1 rounded-full px-3 text-xs transition-colors",
                  mode === m.value
                    ? "bg-primary font-medium text-white"
                    : "text-muted hover:text-ink-2",
                )}
              >
                <Languages className="size-3.5" />
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[1fr_300px]">
        {/* 正文:对照翻译 + 图表 */}
        <div className="space-y-5">
          {readerSections.map((section, si) => (
            <section
              key={section.id}
              className="rounded-2xl bg-card p-6 shadow-card"
            >
              <h2 className="text-[15px] font-bold text-ink">
                {mode === "en" ? section.heading : section.headingZh}
              </h2>
              {mode === "bilingual" && (
                <p className="text-xs text-faint">{section.heading}</p>
              )}
              <div className="mt-4 space-y-5">
                {section.paragraphs.map((p) => (
                  <Paragraph
                    key={p.id}
                    en={p.en}
                    zh={p.zh}
                    mode={mode}
                    onAnnotate={(quote, note) => addAnnotation(quote, note)}
                  />
                ))}
              </div>
              {/* 图表插在方法节之后 */}
              {si === 1 &&
                readerFigures.map((fig) => (
                  <figure
                    key={fig.id}
                    className="mt-5 rounded-xl border border-line"
                  >
                    <div className="flex h-40 items-center justify-center rounded-t-xl bg-panel text-xs text-faint">
                      <ScanEye className="mr-2 size-4" />
                      {fig.caption}(图占位)
                    </div>
                    <figcaption className="border-t border-line px-4 py-2.5 text-xs text-muted">
                      {mode === "en" ? fig.caption : fig.captionZh}
                    </figcaption>
                    <div className="border-t border-line bg-primary-soft/40 px-4 py-3">
                      <p className="flex items-start gap-2 text-[13px] leading-relaxed text-ink-2">
                        <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" />
                        {fig.explanation}
                      </p>
                    </div>
                  </figure>
                ))}
            </section>
          ))}
        </div>

        {/* 侧栏:AI 摘要 + 批注 */}
        <aside className="space-y-5">
          <section className="rounded-2xl bg-card p-5 shadow-card">
            <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
              <Sparkles className="size-4 text-primary" />
              AI 摘要
            </h3>
            <p className="mt-3 text-[13px] leading-relaxed text-muted">
              {readerPaper.summary}
            </p>
          </section>

          <section className="rounded-2xl bg-card p-5 shadow-card">
            <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
              <Highlighter className="size-4 text-muted" />
              批注
              <span className="text-xs font-normal text-faint">
                {annotations.length} 条
              </span>
            </h3>

            {/* 新增批注 */}
            <div className="mt-3 rounded-xl border border-line p-3">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={2}
                placeholder="写下你的想法…"
                className="w-full resize-none bg-transparent text-[13px] text-ink outline-none placeholder:text-faint"
              />
              <div className="mt-1.5 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    addAnnotation("自由批注", draft);
                    setDraft("");
                  }}
                  className="flex h-7 cursor-pointer items-center gap-1 rounded-lg bg-primary px-2.5 text-xs font-medium text-white transition-colors hover:bg-primary/90"
                >
                  <Plus className="size-3.5" />
                  添加
                </button>
              </div>
            </div>

            <ul className="mt-3 space-y-3">
              {annotations.map((a) => (
                <li
                  key={a.id}
                  className="rounded-xl bg-panel p-3 text-[13px]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="border-l-2 border-primary pl-2 text-xs italic leading-relaxed text-muted">
                      {a.quote}
                    </p>
                    <button
                      type="button"
                      aria-label="删除批注"
                      onClick={() =>
                        setAnnotations((prev) =>
                          prev.filter((x) => x.id !== a.id),
                        )
                      }
                      className="shrink-0 cursor-pointer rounded p-0.5 text-faint transition-colors hover:text-danger"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                  <p className="mt-2 leading-relaxed text-ink-2">{a.note}</p>
                  <p className="mt-1.5 text-[11px] text-faint">{a.createdAt}</p>
                </li>
              ))}
              {annotations.length === 0 && (
                <p className="rounded-xl bg-panel p-4 text-center text-xs text-faint">
                  暂无批注,在正文段落上点「批注」试试
                </p>
              )}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}

/** 对照段落:hover 出现「批注」入口,点击把该段金句加入批注 */
function Paragraph({
  en,
  zh,
  mode,
  onAnnotate,
}: {
  en: string;
  zh: string;
  mode: ViewMode;
  onAnnotate: (quote: string, note: string) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [note, setNote] = React.useState("");

  return (
    <div className="group relative">
      {mode !== "zh" && (
        <p className="text-[14px] leading-relaxed text-ink-2">{en}</p>
      )}
      {mode !== "en" && (
        <p
          className={cn(
            "text-[14px] leading-relaxed",
            mode === "bilingual"
              ? "mt-1.5 border-l-2 border-primary/30 pl-3 text-muted"
              : "text-ink-2",
          )}
        >
          {zh}
        </p>
      )}

      <button
        type="button"
        onClick={() => setEditing((v) => !v)}
        className="absolute -right-1 -top-1 hidden cursor-pointer items-center gap-1 rounded-lg bg-chip px-2 py-1 text-[11px] text-muted transition-colors hover:text-primary group-hover:flex"
      >
        <Highlighter className="size-3" />
        批注
      </button>

      {editing && (
        <div className="mt-2 rounded-xl border border-line bg-panel p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-faint">批注本段</p>
            <button
              type="button"
              aria-label="取消"
              onClick={() => setEditing(false)}
              className="cursor-pointer rounded p-0.5 text-faint hover:text-ink"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            autoFocus
            placeholder="记录这段的要点、疑问或实验思路…"
            className="mt-1.5 w-full resize-none bg-transparent text-[13px] text-ink outline-none placeholder:text-faint"
          />
          <div className="mt-1 flex justify-end">
            <button
              type="button"
              onClick={() => {
                onAnnotate(en.slice(0, 60) + (en.length > 60 ? "…" : ""), note);
                setNote("");
                setEditing(false);
              }}
              className="flex h-7 cursor-pointer items-center gap-1 rounded-lg bg-primary px-2.5 text-xs font-medium text-white transition-colors hover:bg-primary/90"
            >
              保存批注
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
