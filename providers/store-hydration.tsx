"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth";
import { useSidebarStore } from "@/stores/sidebar";
import { useUserPreferences } from "@/stores/user-preferences";

/**
 * 客户端 store 水合 —— 根布局挂载一次:
 * 1. persist store 采用 skipHydration,挂载后统一 rehydrate,
 *    保证首帧客户端渲染与 SSR HTML 一致(消除侧边栏折叠态等水合抖动);
 * 2. localStorage 存在 token 时调 /api/auth/me 校验并恢复登录态,
 *    失效则静默清除(不再出现「token 在而用户名丢失」的断裂)。
 */
export function StoreHydration() {
  const restore = useAuthStore((s) => s.restore);

  useEffect(() => {
    void useSidebarStore.persist.rehydrate();
    void useUserPreferences.persist.rehydrate();
    void restore();
  }, [restore]);

  return null;
}
