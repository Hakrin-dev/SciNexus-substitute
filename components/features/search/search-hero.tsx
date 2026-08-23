"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ComposerShell } from "@/components/features/agent/composer";

/** 首页顶部搜索 —— 与 AI 助手相同的输入框样式;Enter 进入深度搜索,Alt+Enter 就地检索论文 */
export function SearchHero({
  onSearchPapers,
}: {
  /** Alt+Enter:就地检索论文(发现页内联展示结果) */
  onSearchPapers?: (query: string) => void;
}) {
  const router = useRouter();
  const [value, setValue] = useState("");

  const send = () => {
    const q = value.trim();
    if (!q) return;
    router.push(`/agents/deep-search?q=${encodeURIComponent(q)}`);
  };

  const searchPapers = () => {
    const q = value.trim();
    if (q) onSearchPapers?.(q);
  };

  return (
    <ComposerShell
      value={value}
      onChange={setValue}
      onSend={send}
      onSearchPapers={searchPapers}
      placeholder="帮我找一下关于扩散模型在机器人控制中的最新综述…"
      menuPlacement="down"
    />
  );
}
