"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useConversations } from "@/lib/api/services";
import { useAuthStore } from "@/stores/auth";
import { cn } from "@/lib/utils";

/**
 * 近期研究栏 —— AI 研究助手页左侧
 * 数据来自真实对话历史(/api/conversations);点击跳转 /agents 并深链打开对应会话。
 */
export function ResearchNav({
  onNewResearch,
}: {
  /** 点击「开启新研究」时触发（由页面负责重置对话状态） */
  onNewResearch?: () => void;
}) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { data: conversations = [] } = useConversations();

  return (
    <aside className="w-52 shrink-0">
      <Button
        className="w-full rounded-xl"
        onClick={() => {
          onNewResearch?.();
        }}
      >
        <Plus className="size-4" />
        开启新研究
      </Button>

      <p className="mt-6 px-1 text-xs text-faint">近期研究</p>
      {!user ? (
        <p className="mt-2 px-1 text-[11px] leading-relaxed text-faint">
          登录后可同步研究历史
        </p>
      ) : conversations.length === 0 ? (
        <p className="mt-2 px-1 text-[11px] leading-relaxed text-faint">
          还没有研究记录,发起一次提问吧
        </p>
      ) : (
        <ul className="mt-2 space-y-1">
          {conversations.slice(0, 8).map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => router.push(`/agents?conv=${encodeURIComponent(c.id)}`)}
                title={c.preview}
                className={cn(
                  "w-full cursor-pointer rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-card/60",
                )}
              >
                <p className="truncate text-[13px] font-medium text-ink-2">{c.title}</p>
                <p className="mt-0.5 truncate text-[11px] text-faint">{c.preview}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
