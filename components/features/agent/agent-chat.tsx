"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
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

/** 原型阶段的模拟回复 */
const MOCK_REPLY =
  "这是原型阶段的模拟回复。接入模型后,我将结合你的知识库与最新文献,为你生成带来源引用的回答。";

/** AI 助手对话页 —— 类似网页版 ChatGPT:空状态居中提问,对话后消息流 + 底部输入框 */
export function AgentChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [value, setValue] = useState("");
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

  if (messages.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-primary-soft">
          <Sparkles className="size-6 text-primary" />
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
    );
  }

  return (
    <div className="flex h-screen flex-col">
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
                  <Sparkles className="size-4 text-primary" />
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
  );
}
