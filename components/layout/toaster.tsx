"use client";

import { CheckCircle2, Info, XCircle } from "lucide-react";
import { useToastStore, type ToastKind } from "@/stores/toast";
import { cn } from "@/lib/utils";

const KIND_ICON: Record<ToastKind, typeof Info> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

const KIND_CLASS: Record<ToastKind, string> = {
  success: "text-success",
  error: "text-danger",
  info: "text-primary",
};

/** 全局 toast 容器 —— 挂根布局,右下角堆叠,自动消失 */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (!toasts.length) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[60] flex flex-col items-end gap-2"
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => {
        const Icon = KIND_ICON[t.kind];
        return (
          <div
            key={t.id}
            className="animate-in fade-in slide-in-from-bottom-2 flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-card px-3.5 py-2.5 text-[13px] text-ink shadow-pop duration-300"
            onClick={() => dismiss(t.id)}
          >
            <Icon className={cn("size-4 shrink-0", KIND_CLASS[t.kind])} />
            <span>{t.message}</span>
          </div>
        );
      })}
    </div>
  );
}
