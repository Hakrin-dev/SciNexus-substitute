"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SidebarState {
  /**
   * 各可展开导航项(投稿/知识库/AI 助手)的展开状态,键为父项路径。
   * 未设置时按当前路由推断(位于该栏目页面下则视为展开)。
   */
  expanded: Record<string, boolean>;
  setExpanded: (key: string, open: boolean) => void;
  /** 整个左侧边栏是否折叠为图标栏 */
  collapsed: boolean;
  toggleCollapsed: () => void;
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      expanded: {},
      setExpanded: (key, open) =>
        set((s) => ({ expanded: { ...s.expanded, [key]: open } })),
      collapsed: false,
      toggleCollapsed: () => set((s) => ({ collapsed: !s.collapsed })),
    }),
    { name: "shenzhi-sidebar" },
  ),
);
