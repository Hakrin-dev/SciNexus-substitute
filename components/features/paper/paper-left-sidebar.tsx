"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PaperToc } from "@/components/features/paper/paper-toc";
import { PageThumbnails } from "@/components/features/paper/page-thumbnails";
import { cn } from "@/lib/utils";
import type { PaperDetail } from "@/types";

/** 悬停展开前需在左边缘停留的时间(ms),避免快速扫过时闪现 */
const OPEN_DELAY = 80;
/** 鼠标移出后延迟收起的时间(ms),期间回到栏内则取消 */
const CLOSE_DELAY = 120;
/** 触发悬停展开的左边缘宽度(px) */
const EDGE_WIDTH = 12;

/**
 * 左侧边栏(本文摘要 + 页码导航)—— 默认折叠。
 * - 悬停:鼠标在页面最左边缘停留片刻临时展开,移出左栏区域后恢复折叠;
 * - 点击:按钮固定展开/收起,固定后不受悬停影响。
 */
export function PaperLeftSidebar({
  toc,
  current,
  total,
}: {
  toc: PaperDetail["toc"];
  current: number;
  total: number;
}) {
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const open = pinned || hovered;

  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);

  const clearOpenTimer = () => {
    if (openTimer.current !== null) {
      window.clearTimeout(openTimer.current);
      openTimer.current = null;
    }
  };
  const clearCloseTimer = () => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  useEffect(
    () => () => {
      clearOpenTimer();
      clearCloseTimer();
    },
    [],
  );

  const handleMouseMove = (e: React.MouseEvent) => {
    // 鼠标仍在栏内移动:取消待执行的收起
    clearCloseTimer();
    // 贴近左边缘:停留 OPEN_DELAY 后才展开,快速扫过不触发
    if (!open && e.clientX <= EDGE_WIDTH && openTimer.current === null) {
      openTimer.current = window.setTimeout(() => {
        openTimer.current = null;
        setHovered(true);
      }, OPEN_DELAY);
    }
  };

  const handleMouseLeave = () => {
    // 未满足停留时间就离开,不展开
    clearOpenTimer();
    if (hovered && closeTimer.current === null) {
      closeTimer.current = window.setTimeout(() => {
        closeTimer.current = null;
        setHovered(false);
      }, CLOSE_DELAY);
    }
  };

  return (
    <div
      className="flex min-h-0 shrink-0"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {open && (
        <>
          <PaperToc toc={toc} />
          <PageThumbnails current={current} total={total} />
        </>
      )}

      <button
        type="button"
        onClick={() => setPinned((v) => !v)}
        aria-label={pinned ? "折叠侧边栏" : "展开侧边栏"}
        title={pinned ? "折叠侧边栏" : "展开侧边栏"}
        className={cn(
          "z-10 hidden size-7 shrink-0 items-center justify-center self-center rounded-full border border-line bg-card text-muted shadow-sm transition-colors hover:text-primary lg:flex",
          open ? "-ml-3.5" : "ml-1.5",
        )}
      >
        {open ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
      </button>
    </div>
  );
}
