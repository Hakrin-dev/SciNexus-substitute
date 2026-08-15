import { createLucideIcon } from "lucide-react";

/**
 * QuestionOutline —— 「质疑」模式图标:普通问号
 * (lucide CircleHelp 同款问号路径,去掉圆圈;
 * 描边渲染,粗细与相邻 lucide 图标一致;
 * 以 (12,11.5) 为基准放大 2 倍)
 */
export const QuestionOutline = createLucideIcon("question-outline", [
  [
    "path",
    {
      d: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3",
      transform: "translate(12 11.5) scale(2) translate(-12 -11.5)",
      key: "hook",
    },
  ],
  [
    "path",
    {
      d: "M12 17h.01",
      transform: "translate(12 11.5) scale(2) translate(-12 -11.5)",
      key: "dot",
    },
  ],
]);
