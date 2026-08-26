"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * 「即将上线」占位按钮 —— 统一未实现功能的语义与视觉:
 * disabled + tooltip 说明,避免"点了没反应"的挫败感。
 */
export function SoonButton({
  tip = "即将上线",
  className,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { tip?: string }) {
  return (
    <Button
      disabled
      title={tip}
      aria-disabled
      className={cn("cursor-not-allowed", className)}
      {...props}
    >
      {children}
    </Button>
  );
}
