"use client";

import * as React from "react";
import { useMemory, useSetMemoryEnabled } from "@/lib/api/services";
import { toast } from "@/stores/toast";
import { cn } from "@/lib/utils";

/** 记忆页「记忆」标题后的总开关(登录后落库持久化;未登录为本地演示态) */
export function MemoryMasterToggle() {
  const { data } = useMemory();
  const setEnabled = useSetMemoryEnabled();
  const memoryEnabled = data.enabled;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={memoryEnabled}
      disabled={setEnabled.isPending}
      onClick={() => {
        setEnabled.mutate(!memoryEnabled);
        toast.success(memoryEnabled ? "已关闭 AI 记忆" : "已开启 AI 记忆");
      }}
      className={cn(
        "relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors",
        memoryEnabled ? "bg-primary" : "bg-line",
        setEnabled.isPending && "opacity-60",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 size-5 rounded-full bg-white shadow transition-all",
          memoryEnabled ? "left-[22px]" : "left-0.5",
        )}
      />
    </button>
  );
}