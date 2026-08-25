"use client";

import { useEffect } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * 全局错误边界 —— 未捕获的渲染错误不再白屏,
 * 提供重试入口;错误详情仅在开发环境展示。
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[scinexus] 页面渲染异常:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-card shadow-card">
        <TriangleAlert className="size-6 text-amber-500" />
      </span>
      <h1 className="text-lg font-semibold text-ink">页面出了点问题</h1>
      <p className="max-w-md text-sm leading-relaxed text-muted">
        渲染时发生了未预期的错误。
        {process.env.NODE_ENV !== "production" && (
          <span className="mt-2 block break-all font-mono text-xs text-faint">
            {error.message}
          </span>
        )}
      </p>
      <Button onClick={reset} className="mt-1">
        <RotateCcw className="size-3.5" />
        重试
      </Button>
    </div>
  );
}
