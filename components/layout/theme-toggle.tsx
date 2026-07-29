"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "shenzhi-theme";

/**
 * 日/夜模式切换 —— 与 layout.tsx 内联脚本配合:
 * 脚本在首屏前根据 localStorage/系统偏好设置 html.dark,这里负责切换与持久化
 */
export function ThemeToggle({ className }: { className?: string }) {
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
    } catch {
      /* 隐私模式下忽略 */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "切换到日间模式" : "切换到夜间模式"}
      title={dark ? "切换到日间模式" : "切换到夜间模式"}
      className={cn(
        "flex size-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-chip hover:text-ink",
        className,
      )}
    >
      {dark === null ? (
        <span className="size-4" />
      ) : dark ? (
        <Sun className="size-4" strokeWidth={1.8} />
      ) : (
        <Moon className="size-4" strokeWidth={1.8} />
      )}
    </button>
  );
}
