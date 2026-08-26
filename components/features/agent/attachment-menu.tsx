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
import {
  useFeedPapers,
  useScholars,
  useInstitutions,
  useProjects,
  useConversations,
} from "@/lib/api/services";
import { useAuthStore } from "@/stores/auth";

/** 引用面板的通用分组:副标题 + 可点击条目(display 展示,token 注入输入框) */
interface RefItem {
  key: string;
  display: string;
  /** 点击后注入输入框的引用文本 */
  token: string;
}

interface RefGroup {
  label: string;
  items: RefItem[];
}

/**
 * 二级面板:悬停展开。
 * expandable(知识库):点击副标题向下展开/收起组内容;
 * 否则(历史对话/科研项目)组内容直接平铺展示,不再折叠。
 */
function RefPanel({
  groups,
  expandable = false,
  onPick,
}: {
  groups: RefGroup[];
  expandable?: boolean;
  onPick: (item: RefItem) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!expandable) {
    // 历史对话/科研项目:只罗列条目,点击即引用
    return (
      <div className="w-64 rounded-xl border border-line bg-card p-1.5 shadow-pop">
        {groups.map((group) => (
          <button
            key={group.label}
            type="button"
            title={group.items[0]?.display}
            onClick={() => group.items[0] && onPick(group.items[0])}
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
                  <li key={item.key}>
                    <button
                      type="button"
                      title={`引用:${item.display}`}
                      onClick={() => onPick(item)}
                      className="flex w-full cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs text-muted transition-colors hover:bg-chip hover:text-ink-2"
                    >
                      <BookOpen className="size-3 shrink-0 text-faint" />
                      <span className="truncate">{item.display}</span>
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
 * 「别针」附件/引用菜单:
 * 上传入口(即将上线,disabled)/ 引用知识库 / 引用历史对话 / 引用科研项目;
 * 后三者悬停向右展开二级面板,点击条目以「@名称」注入输入框并随消息上送 context。
 */
export function AttachmentMenu({
  placement = "down",
  /** 条目被选中时回调(由 ComposerShell 注入输入框) */
  onInsert,
}: {
  /** down:菜单出现在别针下方(居中输入框);up:上方(吸底输入框) */
  placement?: "up" | "down";
  onInsert?: (token: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const user = useAuthStore((s) => s.user);
  const { data: papers = [] } = useFeedPapers();
  const { data: scholars = [] } = useScholars();
  const { data: institutions = [] } = useInstitutions();
  const { data: projects = [] } = useProjects();
  const { data: conversations = [] } = useConversations();

  const pick = (item: RefItem) => {
    onInsert?.(`@${item.token}`);
    setOpen(false);
  };

  const knowledgeGroups: RefGroup[] = [
    { label: "论文库", items: papers.slice(0, 4).map((p) => ({ key: p.id, display: p.title, token: p.title })) },
    { label: "学者", items: scholars.slice(0, 3).map((s) => ({ key: s.id, display: `${s.nameCn} · ${s.affiliation}`, token: s.nameCn })) },
    { label: "研究机构", items: institutions.slice(0, 3).map((i) => ({ key: i.id, display: `${i.nameCn} · ${i.type}`, token: i.nameCn })) },
  ];
  const projectGroups: RefGroup[] = projects.map((p) => ({
    label: p.name,
    items: [
      { key: p.id, display: `简介:${p.tagline}`, token: p.name },
      ...p.milestones.slice(0, 2).map((m, i) => ({
        key: `${p.id}-ms-${i}`,
        display: `里程碑:${m.title}`,
        token: p.name,
      })),
    ],
  }));
  const conversationGroups: RefGroup[] = conversations.slice(0, 4).map((c) => ({
    label: c.title || c.preview || c.id,
    items: [{ key: c.id, display: c.preview || c.title, token: c.title || "历史对话" }],
  }));

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

  const REF_ITEMS: {
    label: string;
    icon: typeof Library;
    groups: RefGroup[];
    expandable: boolean;
    emptyHint: string;
  }[] = [
    { label: "引用知识库", icon: Library, groups: knowledgeGroups, expandable: true, emptyHint: "暂无可引用内容" },
    {
      label: "引用历史对话",
      icon: History,
      groups: conversationGroups,
      expandable: false,
      emptyHint: user ? "还没有对话记录" : "登录后可引用历史对话",
    },
    { label: "引用科研项目", icon: Layers, groups: projectGroups, expandable: false, emptyHint: "暂无科研项目" },
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
                {item.groups.length > 0 ? (
                  <RefPanel groups={item.groups} expandable={item.expandable} onPick={pick} />
                ) : (
                  <div className="w-64 rounded-xl border border-line bg-card px-3 py-2.5 text-xs text-faint shadow-pop">
                    {item.emptyHint}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
