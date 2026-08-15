/** 全局常量 —— 与原型设计稿对齐 */

export const SITE = {
  name: "研枢",
  fullName: "SciNexus",
  user: {
    name: "未登录",
    title: "",
  },
} as const;

/** 侧边栏导航槽位(与 SVG 原型的 44px 间距一致) */
export const NAV_SECTIONS = {
  research: "研究",
  explore: "探索",
} as const;
