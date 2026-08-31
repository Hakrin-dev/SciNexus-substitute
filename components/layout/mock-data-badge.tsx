"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MOCK_DOMAIN, MOCK_TAG } from "@/lib/api/services";
import { useSidebarStore } from "@/stores/sidebar";
import { cn } from "@/lib/utils";

/**
 * 演示数据全局提示徽章
 * 订阅 Query 缓存:任一「当前挂载」的查询命中 MOCK_TAG(接口失败回退 mock)时,
 * 在左下角常驻提示,避免假数据被误当真实数据。
 */
export function MockDataBadge() {
  const queryClient = useQueryClient();
  const [visible, setVisible] = useState(false);
  const [domains, setDomains] = useState<string[]>([]);
  const collapsed = useSidebarStore((s) => s.collapsed);

  useEffect(() => {
    const cache = queryClient.getQueryCache();
    // 缓存事件可能在其它组件渲染期间同步派发,这里延迟到下一帧再 setState,
    // 避免「Cannot update a component while rendering a different component」
    let raf = 0;
    const scan = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const fallbackDomains = cache.getAll().flatMap((q) => {
          const data = q.state.data;
          if (q.getObserversCount() <= 0 || !data || typeof data !== "object" || !(MOCK_TAG in data)) return [];
          const domain = (data as Record<symbol, unknown>)[MOCK_DOMAIN];
          return typeof domain === "string" ? [domain] : ["其他数据"];
        });
        setDomains([...new Set(fallbackDomains)]);
        setVisible(fallbackDomains.length > 0);
      });
    };
    scan();
    const unsubscribe = cache.subscribe(scan);
    return () => {
      cancelAnimationFrame(raf);
      unsubscribe();
    };
  }, [queryClient]);

  if (!visible) return null;
  return (
    <div
      className={cn(
        "fixed bottom-4 left-4 z-50 flex items-center gap-1.5 rounded-full border border-amber-300/70 bg-amber-50 px-3 py-1 text-[11px] font-medium text-amber-800 shadow-sm transition-[left] duration-200 dark:border-amber-500/40 dark:bg-amber-950/70 dark:text-amber-200",
        collapsed ? "lg:left-20" : "lg:left-64",
      )}
    >
      <span className="size-1.5 rounded-full bg-amber-500" aria-hidden />
      演示数据：{domains.join("、")}（不代表知识底座状态）
    </div>
  );
}
