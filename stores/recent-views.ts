"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ViewKind = "paper" | "scholar";

export interface ViewItem {
  kind: ViewKind;
  id: string;
  title: string;
  /** 副标题(venue / 机构等) */
  subtitle?: string;
  /** 最近一次访问时间戳 */
  at: number;
}

interface RecentViewsState {
  items: ViewItem[];
  /** 记录一次访问:同 kind+id 去重并更新时间,置顶;上限 50 条 */
  record: (item: Omit<ViewItem, "at">) => void;
  clear: () => void;
}

const MAX_ITEMS = 50;

/** 浏览记录(本地埋点,persist 键 scinexus-recent-views) */
export const useRecentViews = create<RecentViewsState>()(
  persist(
    (set) => ({
      items: [],
      record: (item) =>
        set((s) => {
          const rest = s.items.filter(
            (v) => !(v.kind === item.kind && v.id === item.id),
          );
          return {
            items: [{ ...item, at: Date.now() }, ...rest].slice(0, MAX_ITEMS),
          };
        }),
      clear: () => set({ items: [] }),
    }),
    {
      name: "scinexus-recent-views",
      skipHydration: true,
    },
  ),
);
