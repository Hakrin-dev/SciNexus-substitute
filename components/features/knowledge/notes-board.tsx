"use client";

import * as React from "react";
import { FileText, Pencil, Plus, Search, Tag, Trash2, X } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDemoState } from "@/stores/demo-state";
import { toast } from "@/stores/toast";
import { cn } from "@/lib/utils";
import type { NoteItem } from "@/lib/data/notes";

/** 格式化更新时间为「8月22日」 */
function formatDay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${Number(m[2])}月${Number(m[3])}日` : iso;
}

interface Draft {
  id?: string;
  title: string;
  content: string;
  tags: string;
  paperTitle: string;
}

const EMPTY_DRAFT: Draft = { title: "", content: "", tags: "", paperTitle: "" };

/** 知识库·笔记 —— 搜索/标签筛选 + 行内新建编辑(演示态,本地持久化) */
export function NotesBoard() {
  const notes = useDemoState((s) => s.notes);
  const addNote = useDemoState((s) => s.addNote);
  const updateNote = useDemoState((s) => s.updateNote);
  const deleteNote = useDemoState((s) => s.deleteNote);

  const [query, setQuery] = React.useState("");
  const [activeTag, setActiveTag] = React.useState<string | null>(null);
  /** 编辑中的草稿;null=关闭;id 为空表示新建 */
  const [draft, setDraft] = React.useState<Draft | null>(null);

  const allTags = React.useMemo(() => {
    const set = new Set<string>();
    for (const n of notes) for (const t of n.tags) set.add(t);
    return [...set];
  }, [notes]);

  const filtered = notes.filter((n) => {
    if (activeTag && !n.tags.includes(activeTag)) return false;
    const q = query.trim().toLowerCase();
    return !q || `${n.title} ${n.content}`.toLowerCase().includes(q);
  });

  const startEdit = (note: NoteItem) => {
    setDraft({
      id: note.id,
      title: note.title,
      content: note.content,
      tags: note.tags.join(", "),
      paperTitle: note.paperTitle ?? "",
    });
  };

  const handleSave = () => {
    if (!draft) return;
    if (!draft.title.trim() && !draft.content.trim()) {
      toast.error("标题和内容至少填一项");
      return;
    }
    const payload = {
      title: draft.title.trim() || "无标题笔记",
      content: draft.content,
      tags: draft.tags
        .split(/[,，]/)
        .map((t) => t.trim())
        .filter(Boolean),
      paperTitle: draft.paperTitle.trim() || undefined,
    };
    if (draft.id) {
      updateNote(draft.id, payload);
      toast.success("笔记已更新");
    } else {
      addNote(payload);
      toast.success("笔记已创建");
    }
    setDraft(null);
  };

  const handleDelete = (note: NoteItem) => {
    deleteNote(note.id);
    if (draft?.id === note.id) setDraft(null);
    toast.success("笔记已删除");
  };

  /* ── 编辑器 ── */
  if (draft) {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-2 space-y-4 rounded-2xl bg-card p-6 shadow-card duration-300">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-ink">
            {draft.id ? "编辑笔记" : "新建笔记"}
          </h2>
          <button
            type="button"
            aria-label="关闭"
            onClick={() => setDraft(null)}
            className="cursor-pointer rounded-md p-1 text-faint hover:bg-chip hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </div>
        <Input
          placeholder="笔记标题"
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        />
        <textarea
          value={draft.content}
          onChange={(e) => setDraft({ ...draft, content: e.target.value })}
          placeholder="正文(支持多行纯文本)"
          rows={10}
          className="w-full resize-y rounded-xl border border-line bg-card px-4 py-3 text-sm leading-relaxed text-ink outline-none transition-colors placeholder:text-faint focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/15"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-ink-2">
              标签<span className="ml-1 font-normal text-faint">(逗号分隔)</span>
            </span>
            <Input
              placeholder="如: 综述管线, 引用对齐"
              value={draft.tags}
              onChange={(e) => setDraft({ ...draft, tags: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-ink-2">
              关联论文<span className="ml-1 font-normal text-faint">(可选)</span>
            </span>
            <Input
              placeholder="论文标题"
              value={draft.paperTitle}
              onChange={(e) => setDraft({ ...draft, paperTitle: e.target.value })}
            />
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDraft(null)}>
            取消
          </Button>
          <Button onClick={handleSave}>保存</Button>
        </div>
      </div>
    );
  }

  /* ── 列表视图 ── */
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <Input
            placeholder="搜索笔记…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {allTags.slice(0, 6).map((tag) => (
            <button
              key={tag}
              type="button"
              aria-pressed={activeTag === tag}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              className={cn(
                "h-7 cursor-pointer rounded-full px-3 text-xs transition-colors",
                activeTag === tag
                  ? "bg-primary font-medium text-white"
                  : "bg-chip text-muted hover:text-ink-2",
              )}
            >
              {tag}
            </button>
          ))}
        </div>
        <Button
          size="sm"
          className="ml-auto rounded-xl"
          onClick={() => setDraft({ ...EMPTY_DRAFT })}
        >
          <Plus className="size-3.5" />
          新建笔记
        </Button>
      </div>

      {filtered.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {filtered.map((note, i) => (
            <article
              key={note.id}
              className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both group rounded-xl border border-line bg-card p-4 duration-300 hover:border-primary/40"
              style={{ animationDelay: `${Math.min(i * 30, 240)}ms` }}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 truncate text-sm font-semibold text-ink">{note.title}</p>
                <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    aria-label="编辑"
                    onClick={() => startEdit(note)}
                    className="cursor-pointer rounded-md p-1.5 text-faint hover:bg-chip hover:text-primary"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="删除"
                    onClick={() => handleDelete(note)}
                    className="cursor-pointer rounded-md p-1.5 text-faint hover:bg-chip hover:text-danger"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
              <p className="mt-1.5 line-clamp-3 whitespace-pre-line text-[13px] leading-relaxed text-muted">
                {note.content}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                {note.paperTitle && (
                  <Link
                    href={`/papers/${note.paperId || ""}`}
                    onClick={(e) => !note.paperId && e.preventDefault()}
                    className="flex min-w-0 items-center gap-1 text-[11px] text-primary hover:underline"
                  >
                    <FileText className="size-3 shrink-0" />
                    <span className="truncate">{note.paperTitle}</span>
                  </Link>
                )}
                {note.tags.map((tag) => (
                  <span key={tag} className="flex items-center gap-0.5 text-[11px] text-faint">
                    <Tag className="size-3" />
                    {tag}
                  </span>
                ))}
                <span className="ml-auto shrink-0 text-[11px] text-faint">
                  {formatDay(note.updatedAt)}
                </span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl bg-card p-12 text-center shadow-card">
          <StickyIcon />
          <p className="mt-3 text-sm text-muted">没有匹配的笔记</p>
          <p className="mt-1 text-xs text-faint">换个关键词或清除标签筛选试试</p>
        </div>
      )}
    </div>
  );
}

function StickyIcon() {
  return (
    <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-chip">
      <FileText className="size-5 text-faint" />
    </span>
  );
}
