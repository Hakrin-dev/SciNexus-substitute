/** 全局常量 —— 与原型设计稿对齐 */

export const SITE = {
  name: "深知",
  fullName: "ShenZhi · Research OS",
  user: {
    name: "陈知行",
    title: "研究员 · 清华 AI Lab",
  },
} as const;

/** 侧边栏导航槽位(与 SVG 原型的 44px 间距一致) */
export const NAV_SECTIONS = {
  research: "研究",
  explore: "探索",
} as const;
