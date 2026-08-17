"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ComposerShell } from "@/components/features/agent/composer";

/** 首页顶部搜索 —— 与 AI 助手相同的输入框样式,提交后进入深度搜索 */
export function SearchHero() {
  const router = useRouter();
  const [value, setValue] = useState("");

  const send = () => {
    const q = value.trim();
    if (!q) return;
    router.push(`/agents/deep-search?q=${encodeURIComponent(q)}`);
  };

  return (
    <ComposerShell
      value={value}
      onChange={setValue}
      onSend={send}
      placeholder="帮我找一下关于扩散模型在机器人控制中的最新综述…"
      menuPlacement="down"
    />
  );
}
