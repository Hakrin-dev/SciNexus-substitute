"use client";

import { useEffect, useRef, useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { PromptCircle } from "@/components/icons/prompt-circle";
import { cn } from "@/lib/utils";
import { ComposerShell } from "./composer";

interface Message {
  role: "user" | "assistant";
  content: string;
}

/** 空状态的建议问题(对应 ChatGPT 首页的建议卡片) */
const SUGGESTIONS = [
  "帮我总结一下扩散模型在机器人控制中的最新进展",
  "RDT-1B 和 π0 的技术路线有什么差异?",
  "推荐几篇机器人基础模型方向值得精读的论文",
  "帮我起草一份关于操作泛化性的研究计划",
];

/** 演示用历史对话 */
const HISTORY = [
  "长上下文 Transformer 调研",
  "NeurIPS 2026 投稿筛选",
  "扩散模型效率优化",
  "操作泛化性研究计划",
];

/** 原型阶段的模拟回复 */
const MOCK_REPLY =
  "这是原型阶段的模拟回复。接入模型后,我将结合你的知识库与最新文献,为你生成带来源引用的回答。";

/** AI 助手对话页 —— 类似网页版 ChatGPT:空状态居中提问,对话后消息流 + 底部输入框 */
export function AgentChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [value, setValue] = useState("");
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const replyTimer = useRef<number | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(
    () => () => {
      if (replyTimer.current !== null) window.clearTimeout(replyTimer.current);
    },
    [],
  );

  const send = (text?: string) => {
    const q = (text ?? value).trim();
    if (!q) return;
    setValue("");
    setMessages((prev) => [...prev, { role: "user", content: q }]);
    replyTimer.current = window.setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: MOCK_REPLY },
      ]);
    }, 400);
  };

  const composer = (
    <ComposerShell
      value={value}
      onChange={setValue}
      onSend={() => send()}
      placeholder="使用'@'引用或使用'/'唤起插件或技能…"
      menuPlacement="down"
    />
  );

  /** 左侧对话历史栏:顶端「新对话」,下面为历史列表(演示) */
  const historyPanel = (
    <aside className="flex h-screen w-56 shrink-0 flex-col border-r border-line bg-sidebar p-3">
      <button
        type="button"
        onClick={() => {
          setMessages([]);
          setActiveConv(null);
          setValue("");
        }}
        className="flex h-10 shrink-0 cursor-pointer items-center gap-2.5 rounded-xl bg-primary px-3 text-sm font-medium text-white transition-colors hover:bg-primary/90"
      >
        <MessageSquarePlus className="size-4" strokeWidth={1.8} />
        新对话
      </button>
      <p className="shrink-0 px-3 pb-1.5 pt-4 text-[11px] font-medium tracking-wide text-faint">
        历史对话
      </p>
      <div className="scrollbar-subtle flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
        {HISTORY.map((title) => (
          <button
            key={title}
            type="button"
            aria-current={activeConv === title ? "page" : undefined}
            onClick={() => setActiveConv(title)}
            className={cn(
              "flex h-9 shrink-0 cursor-pointer items-center rounded-lg px-3 text-left text-sm transition-colors",
              activeConv === title
                ? "bg-card font-medium text-primary shadow-sm"
                : "text-muted hover:bg-card hover:text-ink-2",
            )}
          >
            <span className="truncate">{title}</span>
          </button>
        ))}
      </div>
    </aside>
  );

  if (messages.length === 0) {
    return (
      <div className="flex">
        {historyPanel}
        <div className="flex min-h-screen min-w-0 flex-1 flex-col items-center justify-center gap-6 px-6">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-primary-soft">
            <PromptCircle className="size-6 text-primary" />
          </span>
          <h1 className="text-xl font-semibold text-ink">
            有什么我可以帮你研究的?
          </h1>
          <div className="w-full max-w-4xl">{composer}</div>
          <div className="flex max-w-4xl flex-wrap items-center justify-center gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="cursor-pointer rounded-full border border-line bg-card px-3.5 py-1.5 text-[13px] text-muted transition-colors hover:border-primary/40 hover:text-primary"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex">
      {historyPanel}
      <div className="flex h-screen min-w-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
            {messages.map((msg, i) =>
              msg.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <p className="max-w-[80%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm leading-relaxed text-white">
                    {msg.content}
                  </p>
                </div>
              ) : (
                <div key={i} className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft">
                    <PromptCircle className="size-4 text-primary" />
                  </span>
                  <p className="max-w-[80%] rounded-2xl rounded-tl-md bg-card px-4 py-2.5 text-sm leading-relaxed text-ink shadow-card">
                    {msg.content}
                  </p>
                </div>
              ),
            )}
            <div ref={bottomRef} />
          </div>
        </div>
        <div className="px-6 pb-5">
          <div className="mx-auto max-w-5xl">{composer}</div>
        </div>
      </div>
    </div>
  );
}
