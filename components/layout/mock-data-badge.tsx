"use client";

import { useEffect, useState } from "react";
import { useQueryClient, type QueryCache } from "@tanstack/react-query";
import { MOCK_TAG } from "@/lib/api/services";

/**
 * 演示数据全局提示徽章
 * 订阅 Query 缓存:任一「当前挂载」的查询命中 MOCK_TAG(接口失败回退 mock)时,
 * 在左下角常驻提示,避免假数据被误当真实数据。
 */
export function MockDataBadge() {
  const queryClient = useQueryClient();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const cache = queryClient.getQueryCache();
    const scan = () => {
      setVisible(
        cache
          .getAll()
          .some(
            (q) =>
              q.getObserversCount() > 0 &&
              q.state.data !== undefined &&
              typeof q.state.data === "object" &&
              q.state.data !== null &&
              MOCK_TAG in (q.state.data as object),
          ),
      );
    };
    scan();
    return cache.subscribe(scan as Parameters<QueryCache["subscribe"]>[0]);
  }, [queryClient]);

  if (!visible) return null;
  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-1.5 rounded-full border border-amber-300/70 bg-amber-50 px-3 py-1 text-[11px] font-medium text-amber-800 shadow-sm dark:border-amber-500/40 dark:bg-amber-950/70 dark:text-amber-200">
      <span className="size-1.5 rounded-full bg-amber-500" aria-hidden />
      演示数据 · 后端接口未连通
    </div>
  );
}
