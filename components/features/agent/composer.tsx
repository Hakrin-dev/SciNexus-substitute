"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Atom,
  ChevronDown,
  Globe,
  Lightbulb,
  Plug,
  Plus,
  Scroll,
  Zap,
} from "lucide-react";
import { QuestionOutline } from "@/components/icons/question-outline";
import { cn } from "@/lib/utils";
import { AttachmentMenu } from "./attachment-menu";

/** 模型选择(演示) */
const MODELS = ["默认", "订阅", "API接入"] as const;

/** 模式选择(演示):快速 / 深度 / 灵感 / 质疑 */
const MODES = [
  { value: "fast", label: "快速", icon: Zap },
  { value: "deep", label: "深度", icon: Atom },
  { value: "idea", label: "灵感", icon: Lightbulb },
  { value: "doubt", label: "质疑", icon: QuestionOutline },
] as const;

function useCloseOnOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, close]);
  return ref;
}

/** 「+」菜单(演示):插件 / 技能 / 联网搜索,点击展开 */
function PlusMenu({ placement = "down" }: { placement?: "up" | "down" }) {
  const [open, setOpen] = useState(false);
  const ref = useCloseOnOutside(open, () => setOpen(false));

  const ITEMS = [
    { label: "插件", icon: Plug },
    { label: "技能", icon: Scroll },
    { label: "联网搜索", icon: Globe },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="更多操作"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex size-9 cursor-pointer items-center justify-center rounded-xl transition-colors",
          open ? "bg-chip text-ink" : "text-muted hover:bg-chip",
        )}
      >
        <Plus
          className={cn("size-5 transition-transform", open && "rotate-45")}
        />
      </button>
      {open && (
        <div
          className={cn(
            "absolute left-0 z-50 w-40 rounded-xl border border-line bg-card p-1.5 shadow-pop",
            placement === "down" ? "top-full mt-2" : "bottom-full mb-2",
          )}
        >
          {ITEMS.map((item) => (
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
        </div>
      )}
    </div>
  );
}

/** 模型选择(演示):默认 / 订阅 / API接入 */
function ModelSelect() {
  const [model, setModel] = useState<(typeof MODELS)[number]>("默认");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-7 cursor-pointer items-center gap-1 rounded-lg bg-chip px-2.5 text-xs text-ink-2 transition-colors hover:text-ink"
      >
        {model}
        <ChevronDown
          className={cn("size-3 text-faint transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-28 rounded-xl border border-line bg-card p-1 shadow-pop">
          {MODELS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setModel(m);
                setOpen(false);
              }}
              className={cn(
                "flex h-8 w-full cursor-pointer items-center rounded-lg px-2.5 text-xs transition-colors",
                m === model
                  ? "bg-primary-soft font-medium text-primary"
                  : "text-ink-2 hover:bg-chip",
              )}
            >
              {m}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** 模式选择(演示):蓝底白字触发钮,点击展开四种模式 */
function ModeSelect({ placement = "down" }: { placement?: "up" | "down" }) {
  const [mode, setMode] = useState<(typeof MODES)[number]["value"]>("fast");
  const [open, setOpen] = useState(false);
  const ref = useCloseOnOutside(open, () => setOpen(false));
  const current = MODES.find((m) => m.value === mode) ?? MODES[0];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 cursor-pointer items-center gap-1.5 rounded-xl bg-primary px-3 text-[13px] font-medium text-white transition-colors hover:bg-primary/90"
      >
        <current.icon className="size-4" strokeWidth={1.8} />
        {current.label}
        <ChevronDown
          className={cn("size-3.5 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div
          className={cn(
            "absolute right-0 z-50 w-36 rounded-xl border border-line bg-card p-1.5 shadow-pop",
            placement === "down" ? "top-full mt-2" : "bottom-full mb-2",
          )}
        >
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => {
                setMode(m.value);
                setOpen(false);
              }}
              className={cn(
                "flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors",
                m.value === mode
                  ? "bg-primary-soft font-medium text-primary"
                  : "text-ink-2 hover:bg-chip",
              )}
            >
              <m.icon className="size-4" strokeWidth={1.8} />
              {m.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * 加高版提问框(演示):
 * 框内右上为模型选择,右下为模式选择 + 发送,左下为「+」与别针(引用菜单)。
 */
export function ComposerShell({
  value,
  onChange,
  onSend,
  placeholder,
  menuPlacement = "down",
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  placeholder: string;
  menuPlacement?: "up" | "down";
}) {
  return (
    <div className="rounded-2xl bg-card p-3 shadow-pop">
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault();
              onSend();
            }
          }}
          placeholder={placeholder}
          rows={2}
          className="h-[72px] w-full resize-none bg-transparent px-1.5 pt-1 text-sm leading-relaxed text-ink outline-none placeholder:text-faint"
        />
        {/* 右上:模型选择 */}
        <div className="absolute right-1 top-0.5">
          <ModelSelect />
        </div>
      </div>

      <div className="mt-1 flex items-center gap-1.5">
        {/* 左下:+(插件/技能/联网搜索)与别针(上传/引用) */}
        <PlusMenu placement={menuPlacement} />
        <AttachmentMenu placement={menuPlacement} />

        {/* 右下:模式选择 + 发送 */}
        <div className="ml-auto flex items-center gap-2">
          <ModeSelect placement={menuPlacement} />
          <button
            type="button"
            aria-label="发送"
            onClick={onSend}
            className={cn(
              "flex size-9 cursor-pointer items-center justify-center rounded-xl transition-colors",
              value.trim()
                ? "bg-primary text-white hover:bg-primary/90"
                : "bg-chip text-faint",
            )}
          >
            <ArrowUp className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
