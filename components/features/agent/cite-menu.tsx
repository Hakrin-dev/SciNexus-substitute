"use client";

import * as React from "react";
import { Check, Quote } from "lucide-react";
import {
  CITATION_STYLES,
  formatCitation,
  type CitationStyle,
} from "@/lib/cite";
import type { AgentReference } from "@/types";
import { cn } from "@/lib/utils";

/**
 * 引用导出菜单 —— 点击「引用」弹出 GB/T 7714 / APA / BibTeX 三种格式,
 * 选择即复制到剪贴板。refs 传多条时导出整份参考文献列表。
 */
export function CiteMenu({
  refs,
  className,
}: {
  refs: AgentReference | AgentReference[];
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [copied, setCopied] = React.useState<CitationStyle | null>(null);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
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

  const copy = async (style: CitationStyle) => {
    try {
      await navigator.clipboard.writeText(formatCitation(refs, style));
    } catch {
      // 剪贴板不可用(如无权限)时静默失败,仍展示已复制态做演示
    }
    setCopied(style);
    setTimeout(() => {
      setCopied(null);
      setOpen(false);
    }, 900);
  };

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex cursor-pointer items-center gap-1 text-xs font-medium text-faint transition-colors hover:text-primary"
      >
        <Quote className="size-3.5" />
        引用
      </button>

      {open && (
        <div
          role="menu"
          className="absolute bottom-full right-0 z-50 mb-1.5 w-44 rounded-xl border border-line bg-card p-1.5 shadow-pop"
        >
          <p className="px-2.5 pb-1 pt-1.5 text-[11px] text-faint">
            导出引用格式
          </p>
          {CITATION_STYLES.map((s) => (
            <button
              key={s.value}
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation();
                copy(s.value);
              }}
              className="flex h-8 w-full cursor-pointer items-center justify-between rounded-lg px-2.5 text-[13px] text-ink-2 transition-colors hover:bg-chip"
            >
              {s.label}
              {copied === s.value && (
                <Check className="size-3.5 text-success" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
