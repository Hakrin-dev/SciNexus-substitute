"use client";

import { useState } from "react";
import { ArrowUp, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/** 底部提问输入框 —— 支持追问 / 上传 PDF / arXiv 链接 */
export function ChatInput() {
  const [value, setValue] = useState("");

  return (
    <div className="sticky bottom-4">
      <div className="flex items-center gap-2 rounded-2xl bg-card p-2.5 shadow-pop">
        <button
          type="button"
          aria-label="上传附件"
          className="flex size-9 cursor-pointer items-center justify-center rounded-xl text-muted transition-colors hover:bg-chip"
        >
          <Plus className="size-5" />
        </button>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="继续提问,或上传 PDF / arXiv 链接以扩展上下文…"
          className="h-9 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-faint"
        />
        <kbd className="rounded border border-line px-1.5 py-0.5 text-[11px] text-faint">
          ⌘⏎
        </kbd>
        <button
          type="button"
          aria-label="发送"
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
      <p className="mt-2 text-[11px] text-faint">
        支持上传 PDF / arXiv 链接 · 对话可保存到知识库 · 引用 [N] 可点击跳转
      </p>
    </div>
  );
}
