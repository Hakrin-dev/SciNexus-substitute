"use client";

import { useLayoutEffect, useRef, useState } from "react";

/** 论文页面的基准宽度(px),与原型设计稿一致 */
const BASE_WIDTH = 720;

/**
 * 论文页等比缩放容器 —— 类似 PDF 阅读器的「适合页宽」:
 * 内容按 BASE_WIDTH 渲染,再按「可用宽度 / 基准宽度」整体等比缩放,
 * 宽度始终填满容器,高度随比例增长(超出部分纵向滚动)。
 */
export function PaperZoom({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setZoom(el.clientWidth / BASE_WIDTH);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="w-full">
      <div
        style={{
          width: BASE_WIDTH,
          margin: "0 auto",
          zoom: zoom ?? 1,
          // 首次测量前隐藏,避免缩放系数闪烁
          visibility: zoom === null ? "hidden" : "visible",
        }}
      >
        {children}
      </div>
    </div>
  );
}
