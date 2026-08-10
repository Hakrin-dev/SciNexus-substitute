"use client";

import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  FileUp,
  FolderUp,
  History,
  Layers,
  Library,
  Paperclip,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { feedPapers } from "@/lib/data/papers";
import { patents } from "@/lib/data/patents";
import { fundings } from "@/lib/data/funding";
import { scholars } from "@/lib/data/scholars";
import { institutions } from "@/lib/data/institutions";
import { projects } from "@/lib/data/projects";

/** 引用面板的通用分组:副标题 + 点击向下展开的条目列表(演示) */
interface RefGroup {
  label: string;
  items: string[];
}

const KNOWLEDGE_GROUPS: RefGroup[] = [
  { label: "论文库", items: feedPapers.slice(0, 3).map((p) => p.title) },
  { label: "专利库", items: patents.slice(0, 3).map((p) => p.title) },
  { label: "项目基金库", items: fundings.slice(0, 3).map((f) => f.title) },
  {
    label: "学者关系",
    items: scholars.slice(0, 3).map((s) => `${s.nameCn} · ${s.affiliation}`),
  },
  {
    label: "研究机构",
    items: institutions.slice(0, 3).map((i) => `${i.nameCn} · ${i.type}`),
  },
];

const HISTORY_GROUPS: RefGroup[] = [
  {
    label: "长上下文 Transformer 调研",
    items: ["UltraLong-1M 的核心创新是什么?", "和 StreamingLLM 对比如何?"],
  },
  {
    label: "NeurIPS 2026 投稿筛选",
    items: ["帮我按方向筛一遍接收列表", "这几篇的引用脉络"],
  },
  {
    label: "扩散模型效率优化",
    items: ["视频帧插值的专利空白点", "整理成周报"],
  },
];

const PROJECT_GROUPS: RefGroup[] = projects.map((p) => ({
  label: p.name,
  items: [
    `简介:${p.tagline}`,
    ...p.milestones.slice(0, 2).map((m) => `里程碑:${m.title}`),
  ],
}));

/**
 * 二级面板:悬停展开。
 * expandable(知识库):点击副标题向下展开/收起组内容;
 * 否则(历史对话/科研项目)组内容直接平铺展示,不再折叠。
 */
function RefPanel({
  groups,
  expandable = false,
}: {
  groups: RefGroup[];
  expandable?: boolean;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!expandable) {
    // 历史对话/科研项目:只罗列对话名/项目名,不展开具体内容
    return (
      <div className="w-64 rounded-xl border border-line bg-card p-1.5 shadow-pop">
        {groups.map((group) => (
          <button
            key={group.label}
            type="button"
            className="flex h-8 w-full cursor-pointer items-center rounded-lg px-2.5 text-left text-[13px] text-ink-2 transition-colors hover:bg-chip"
          >
            <span className="truncate">{group.label}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="w-64 rounded-xl border border-line bg-card p-1.5 shadow-pop">
      {groups.map((group) => {
        const open = expanded === group.label;
        return (
          <div key={group.label}>
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setExpanded(open ? null : group.label)}
              className="flex h-8 w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 text-[13px] text-ink-2 transition-colors hover:bg-chip"
            >
              <span className="flex-1 truncate text-left">{group.label}</span>
              {open ? (
                <ChevronDown className="size-3.5 text-faint" />
              ) : (
                <ChevronRight className="size-3.5 text-faint" />
              )}
            </button>
            {open && (
              <ul className="mb-1 ml-3 border-l border-line pl-2">
                {group.items.map((item) => (
                  <li key={item}>
                    <button
                      type="button"
                      title={item}
                      className="flex w-full cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs text-muted transition-colors hover:bg-chip hover:text-ink-2"
                    >
                      <BookOpen className="size-3 shrink-0 text-faint" />
                      <span className="truncate">{item}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * 「别针」附件/引用菜单(演示):
 * 上传本地文件 / 上传本地文件夹 / 引用知识库 / 引用历史对话 / 引用科研项目;
 * 后三者悬停向右展开二级面板(知识库可再点击展开组内容,其余平铺)。
 */
export function AttachmentMenu({
  placement = "down",
}: {
  /** down:菜单出现在别针下方(居中输入框);up:上方(吸底输入框) */
  placement?: "up" | "down";
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const REF_ITEMS = [
    { label: "引用知识库", icon: Library, groups: KNOWLEDGE_GROUPS, expandable: true },
    { label: "引用历史对话", icon: History, groups: HISTORY_GROUPS },
    { label: "引用科研项目", icon: Layers, groups: PROJECT_GROUPS },
  ];

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="上传附件或引用"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex size-9 cursor-pointer items-center justify-center rounded-xl transition-colors",
          open ? "bg-chip text-ink" : "text-muted hover:bg-chip",
        )}
      >
        <Paperclip className="size-4.5" strokeWidth={1.8} />
      </button>

      {open && (
        <div
          className={cn(
            "absolute left-0 z-50 w-52 rounded-xl border border-line bg-card p-1.5 shadow-pop",
            placement === "down" ? "top-full mt-2" : "bottom-full mb-2",
          )}
        >
          {[
            { label: "上传本地文件", icon: FileUp },
            { label: "上传本地文件夹", icon: FolderUp },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-sm text-ink-2 transition-colors hover:bg-chip"
            >
              <item.icon className="size-4 text-muted" strokeWidth={1.8} />
              {item.label}
            </button>
          ))}

          {REF_ITEMS.map((item) => (
            <div key={item.label} className="group/ref relative">
              <button
                type="button"
                className="flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-sm text-ink-2 transition-colors hover:bg-chip group-hover/ref:bg-chip"
              >
                <item.icon className="size-4 text-muted" strokeWidth={1.8} />
                <span className="flex-1 text-left">{item.label}</span>
                <ChevronRight className="size-3.5 text-faint" />
              </button>
              {/* 悬停向右展开的二级面板 */}
              <div className="invisible absolute bottom-0 left-full z-50 pl-1.5 opacity-0 transition-opacity duration-100 group-hover/ref:visible group-hover/ref:opacity-100">
                <RefPanel groups={item.groups} expandable={item.expandable} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
