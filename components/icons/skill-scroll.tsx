import { createLucideIcon } from "lucide-react";

/**
 * SkillScroll —— 「技能」标识:斜置卷轴,左下为卷起的纸卷截面(带内卷),
 * 中部束带环绕,右上纸页展开外卷。按设计稿(微信图片_20260823101351_1880_2.jpg)
 * 手工矢量化为描边路径,与 lucide 图标同源同风格(currentColor 随文字变色)。
 */
export const SkillScroll = createLucideIcon("skill-scroll", [
  // 卷芯截面
  ["circle", { cx: "6", cy: "18", r: "2.6", key: "coil" }],
  // 卷芯内卷
  ["path", { d: "M6 16.9a1.1 1.1 0 1 0 1.1 1.1", key: "curl" }],
  // 卷轴主体两侧
  ["path", { d: "M4.2 16.2 14 6.4", key: "edge-a" }],
  ["path", { d: "M7.8 19.8 15.4 12.2", key: "edge-b" }],
  // 中部束带(两条横过卷身的弧线)
  ["path", { d: "M10.3 10.1C8.8 12.3 9.6 14.8 12.3 15.3", key: "band-1" }],
  ["path", { d: "M11.9 8.5C10.4 10.7 11.2 13.2 13.7 13.9", key: "band-2" }],
  // 右上展开的纸页(顶边微卷 → 右侧翻下 → 收回卷身)
  [
    "path",
    {
      d: "M14 6.4C15.8 4.1 18.4 3.2 20.6 3.9C20.9 6.2 19.3 9.4 16.6 11.6L15.4 12.2",
      key: "flare",
    },
  ],
  // 展开页的内表面
  ["path", { d: "M17.3 5.7C18.4 7.2 18.1 9.4 16.5 10.9", key: "flare-inner" }],
]);
