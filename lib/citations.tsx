import type { ReactNode } from "react";

/** 将正文中的 [n] 引用标记渲染为主色上标样式 */
export function withCitations(text: string): ReactNode[] {
  return text.split(/(\[\d+\])/g).map((part, i) =>
    /^\[\d+\]$/.test(part) ? (
      <sup key={i} className="mx-0.5 font-medium text-primary">
        {part}
      </sup>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}
