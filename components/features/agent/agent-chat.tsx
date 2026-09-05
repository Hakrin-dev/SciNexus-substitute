"use client";

import { memo, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CircleStop, LogIn, MessageSquarePlus, Share2 } from "lucide-react";
import { PromptCircle } from "@/components/icons/prompt-circle";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/client";
import {
  sendChat,
  quickSearchPapers,
  formatPaperList,
  useConversations,
  fetchConversationMessages,
} from "@/lib/api/services";
import { useAuthStore } from "@/stores/auth";
import { copyText, toast } from "@/stores/toast";
import { LoginModal } from "@/components/auth/login-modal";
import { ReferenceGrid } from "./reference-grid";
import {
  DEFAULT_STEPS,
  WorkflowTrace,
  toRefsFromPapers,
  toRefsFromChat,
  type ChatReference,
  type Workflow,
} from "./workflow-trace";
import {
  ComposerShell,
  DEFAULT_MODEL,
  type ComposerMode,
  type ModelChoice,
  type StyleChoice,
} from "./composer";
import { MarkdownView } from "./markdown-view";

/** 单轮回答的结构化附件(深度轮=工作流+参考卡;快速轮=论文卡) */
interface TurnData {
  mode: ComposerMode;
  workflow?: Workflow;
  refs?: ChatReference[];
  papers?: {
    id: string;
    title: string;
    authors: string;
    venue: string;
    ccf: string;
    year: number | null;
    citations: number;
  }[];
}

interface Message {
  /** 自增 id,作列表 key(避免用 index,流式更新时保持身份稳定) */
  id: number;
  role: "user" | "assistant";
  content: string;
  /** assistant 消息可携带结构化回答块 */
  turn?: TurnData;
}

/** 单条消息行(memo 化:流式 delta 只重渲染最后一条,历史消息不参与 reconcile) */
const MessageRow = memo(function MessageRow({ msg }: { msg: Message }) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[80%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm leading-relaxed text-white">
          {msg.content}
        </p>
      </div>
    );
  }

  // 结构化回答块:工作流条 + 参考来源卡
  const refs = msg.turn?.refs?.length
    ? toRefsFromChat(msg.turn.refs)
    : msg.turn?.papers?.length
      ? toRefsFromPapers(msg.turn.papers)
      : null;

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft">
          <PromptCircle className="size-4 text-primary" />
        </span>
        <div className="max-w-[80%] rounded-2xl rounded-tl-md bg-card px-4 py-2.5 shadow-card">
          {msg.content ? (
            <MarkdownView content={msg.content} />
          ) : (
            <span className="text-sm text-faint">思考中…</span>
          )}
        </div>
      </div>
      {msg.turn?.workflow && <WorkflowTrace workflow={msg.turn.workflow} />}
      {refs && <ReferenceGrid refs={refs} />}
    </div>
  );
});

/** 空状态的建议问题(对应 ChatGPT 首页的建议卡片) */
const SUGGESTIONS = [
  "帮我总结一下扩散模型在机器人控制中的最新进展",
  "RDT-1B 和 π0 的技术路线有什么差异?",
  "推荐几篇机器人基础模型方向值得精读的论文",
  "帮我起草一份关于操作泛化性的研究计划",
];

/** 回答失败时的兜底文案(诚实说明,不带运维话术) */
const MOCK_REPLY =
  "回答生成失败，请稍后重试。若持续失败，可能是网络或模型服务暂不可用。";

/** 演示用最大上下文字符数(粗略按 1 token ≈ 2 字符,折合约 16k token) */
const MAX_CONTEXT_CHARS = 32000;
/** 点击圆环 compact 后保留的最近消息条数 */
const COMPACT_KEEP = 6;

/** AI 助手对话页 —— 类似网页版 ChatGPT:空状态居中提问,对话后消息流 + 底部输入框 */
export function AgentChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [value, setValue] = useState("");
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  /** 回答模式：fast=快速（scout 直检 + 简单回答，零 LLM）；deep=深度（完整多智能体工作流） */
  const [mode, setMode] = useState<ComposerMode>("fast");
  /** 深度研究右侧面板：请求开始即展示运行态，完成后替换为后端真实流程 */
  const [researchWorkflow, setResearchWorkflow] = useState<Workflow | null>(null);
  const [researchActive, setResearchActive] = useState(false);
  const [model, setModel] = useState<ModelChoice>(DEFAULT_MODEL);
  /** 回答风格：头脑风暴 / 简明扼要 / 全面细致 / 严谨质疑（透传后端提示词） */
  const [style, setStyle] = useState<StyleChoice | null>(null);
  /** 联网搜索：开启后后端追加互联网来源（Exa MCP，深度/快速模式均生效） */
  const [webSearch, setWebSearch] = useState(false);
  /** compact 压缩点:仅把 compactFrom 之后的消息送入上下文(界面消息流不受影响) */
  const [compactFrom, setCompactFrom] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  /** 消息自增 id */
  const nextIdRef = useRef(1);
  /** 当前流式请求的中止控制器(停止生成 / 组件卸载时断流) */
  const abortRef = useRef<AbortController | null>(null);

  const user = useAuthStore((s) => s.user);
  const { data: conversations = [], refetch: refetchConversations } = useConversations();
  /** 深度模式 401 时的内嵌登录弹窗 */
  const [showLogin, setShowLogin] = useState(false);

  /** 打开历史对话:拉取消息回填画布(assistant 消息还原结构化回答块) */
  const openConversation = async (convId: string) => {
    if (streaming) return;
    setActiveConv(convId);
    try {
      const msgs = await fetchConversationMessages(convId);
      const restored = msgs.map((m) => ({
          id: nextIdRef.current++,
          role: m.role,
          content: m.content,
          turn:
            m.role === "assistant" && (m.workflow || m.references)
              ? {
                  mode: "deep" as const,
                  workflow: (m.workflow as Workflow | undefined) ?? undefined,
                  refs: (m.references as ChatReference[] | undefined) ?? undefined,
                }
              : undefined,
        }));
      setMessages(restored);
      const latestWorkflow = [...restored]
        .reverse()
        .find((m) => m.role === "assistant" && m.turn?.workflow)?.turn?.workflow;
      setResearchWorkflow(latestWorkflow ?? null);
      setResearchActive(false);
      setCompactFrom(0);
    } catch {
      toast.error("加载对话失败，请稍后重试");
    }
  };

  // 深链支持:/agents?conv=xxx(从历史列表等入口跳转)
  const searchParams = useSearchParams();
  const openedConvRef = useRef<string | null>(null);
  useEffect(() => {
    const conv = searchParams.get("conv");
    if (conv && user && openedConvRef.current !== conv && !streaming) {
      openedConvRef.current = conv;
      void openConversation(conv);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 卸载时中止进行中的流,避免对已卸载组件继续 setState
  useEffect(() => () => abortRef.current?.abort(), []);

  /** 更新最后一条消息内容 */
  const setLastContent = (content: string) => {
    setMessages((prev) => {
      if (!prev.length) return prev;
      const next = prev.slice();
      next[next.length - 1] = { ...next[next.length - 1], content };
      return next;
    });
  };

  /** 为最后一条(assistant)消息附加结构化回答块 */
  const setLastTurn = (turn: TurnData) => {
    setMessages((prev) => {
      if (!prev.length) return prev;
      const next = prev.slice();
      next[next.length - 1] = { ...next[next.length - 1], turn };
      return next;
    });
  };

  /** 停止生成 */
  const stopStreaming = () => abortRef.current?.abort();

  const send = async (text?: string, forceMode?: ComposerMode) => {
    const q = (text ?? value).trim();
    if (!q || streaming) return;
    setValue("");
    const effectiveMode = forceMode ?? mode;
    if (effectiveMode === "deep") {
      setResearchActive(true);
      setResearchWorkflow({
        steps: DEFAULT_STEPS.map((step) => ({ ...step })),
        status: "running",
      });
    }
    const history = messages.slice(compactFrom).map((m) => ({
      role: m.role,
      content: m.content,
    }));
    const assistantId = nextIdRef.current++;
    setMessages((prev) => [
      ...prev,
      { id: nextIdRef.current++, role: "user", content: q },
      { id: assistantId, role: "assistant", content: "" },
    ]);
    setStreaming(true);
    const ac = new AbortController();
    abortRef.current = ac;
    let convTouched: string | null = null;
    try {
      if (effectiveMode !== "fast") {
        // 深度模式：完整多智能体工作流（Supervisor → scout/synthesis/... → LLM 组合回答）
        let acc = "";
        let lastFlush = 0;
        let wf: Workflow | undefined;
        let refs: ChatReference[] | undefined;
        for await (const event of sendChat(q, history, ac.signal, model, activeConv ?? undefined, {
          topic: messages[0]?.content ?? q,
          style: style ?? undefined,
        }, effectiveMode, webSearch)) {
          if (event.type === "meta") {
            if (event.meta.conversation_id) {
              convTouched = event.meta.conversation_id;
              setActiveConv(event.meta.conversation_id);
            }
            wf = (event.meta.workflow as Workflow | null) ?? undefined;
            refs = (event.meta.references as ChatReference[] | null) ?? undefined;
            if (wf) setResearchWorkflow(wf);
          }
          if (event.type === "delta") {
            acc += event.text;
            // 节流刷新(~60ms),避免逐 token setState 打满 React 渲染
            const now = Date.now();
            if (now - lastFlush >= 60) {
              lastFlush = now;
              setLastContent(acc);
            }
          }
        }
        // 收尾补一次最终全文 + 结构化回答块
        if (acc) setLastContent(acc);
        if (!acc) {
          setLastContent("（本轮未生成回答，请重试或换一种问法）");
        }
        setLastTurn({ mode: "deep", workflow: wf, refs });
        if (!wf) {
          setResearchWorkflow({
            steps: DEFAULT_STEPS.map((step) => ({ ...step, status: "done" })),
            status: "done",
          });
        }
        setResearchActive(false);
      } else {
        // 快速模式：scout 本地直检;正文只放后端「简易回答」摘要,论文以参考卡呈现
        const { papers, summary, conversationId } = await quickSearchPapers(q, activeConv ?? undefined, webSearch);
        if (conversationId) {
          convTouched = conversationId;
          setActiveConv(conversationId);
        }
        setLastContent(
          summary.trim() || formatPaperList(q, papers),
        );
        setLastTurn({ mode: "fast", papers });
      }
    } catch (e) {
      if (effectiveMode === "deep") setResearchActive(false);
      if (ac.signal.aborted) {
        // 用户主动停止:保留已生成部分
      } else if (e instanceof ApiError && e.status === 401) {
        setLastContent("深度研究需要登录后使用，请先登录。");
        setShowLogin(true);
      } else {
        setLastContent(MOCK_REPLY);
      }
    } finally {
      if (abortRef.current === ac) abortRef.current = null;
      setStreaming(false);
      // 新会话落库后刷新历史列表(快速模式同样会写会话)
      if (convTouched && user) void refetchConversations();
    }
  };

  // URL 自动首跑:/agents?q=xxx&mode=fast|deep(发现页搜索入口;原 deep-search 行为并入)
  const autoRunRef = useRef<string | null>(null);
  useEffect(() => {
    const q = searchParams.get("q")?.trim();
    if (!q || autoRunRef.current === q || streaming || messages.length > 0) return;
    autoRunRef.current = q;
    const m: ComposerMode = searchParams.get("mode") === "deep" ? "deep" : "fast";
    void send(q, m);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  /** 任务进度条:发送键左下;compact 圆环:输入框右上 */
  const totalTurns = messages.filter((m) => m.role === "user").length;
  const doneTurns = messages.filter(
    (m) => m.role === "assistant" && m.content,
  ).length;
  const progress = totalTurns > 0 ? doneTurns / totalTurns : 0;
  const contextChars = messages
    .slice(compactFrom)
    .reduce((n, m) => n + m.content.length, 0);
  const contextRatio = Math.min(1, contextChars / MAX_CONTEXT_CHARS);
  /** 圆环周长(r=8) */
  const RING_C = 50.27;

  const progressBar =
    messages.length > 0 ? (
      <div
        role="progressbar"
        aria-valuenow={Math.round(progress * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        title={`任务进度:${doneTurns}/${totalTurns} 步`}
        className="h-1 w-24 overflow-hidden rounded-full bg-chip"
      >
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    ) : null;

  const compactRing =
    messages.length > 0 ? (
      <button
        type="button"
        aria-label="压缩上下文"
        title={`上下文占用约 ${Math.round(contextRatio * 100)}%(点击 compact 压缩)`}
        onClick={() =>
          setCompactFrom(Math.max(0, messages.length - COMPACT_KEEP))
        }
        className="flex cursor-pointer items-center justify-center"
      >
        <svg viewBox="0 0 20 20" className="size-6 -rotate-90">
            <circle
              cx="10"
              cy="10"
              r="8"
              fill="none"
              strokeWidth="1.5"
              className="stroke-line"
            />
            <circle
              cx="10"
              cy="10"
              r="8"
              fill="none"
              strokeWidth="1.5"
              strokeLinecap="round"
              className="stroke-primary transition-all duration-500"
              strokeDasharray={`${contextRatio * RING_C} ${RING_C}`}
            />
          </svg>
        </button>
    ) : null;

  const composer = (
    <ComposerShell
      value={value}
      onChange={setValue}
      onSend={() => send()}
      onSearchPapers={() => send(undefined, "fast")}
      mode={mode}
      onModeChange={setMode}
      model={model}
      onModelChange={setModel}
      style={style}
      onStyleChange={setStyle}
      webSearch={webSearch}
      onWebSearchChange={setWebSearch}
      placeholder="帮我找一下关于扩散模型在机器人控制中的最新综述…"
      menuPlacement={messages.length === 0 ? "down" : "up"}
      headerRight={compactRing}
      sendLeft={progressBar}
    />
  );

  /** 左侧对话历史栏:顶端「新对话」,下面为真实历史(需登录,数据来自 /api/conversations) */
  const historyPanel = (
    <aside className="flex h-screen w-56 shrink-0 flex-col border-r border-line bg-sidebar p-3">
      <button
        type="button"
        onClick={() => {
          setMessages([]);
          setActiveConv(null);
          setValue("");
          setCompactFrom(0);
          setResearchWorkflow(null);
          setResearchActive(false);
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
        {!user ? (
          <div className="flex flex-col items-center gap-2 rounded-xl bg-card/60 px-3 py-4 text-center">
            <LogIn className="size-4 text-faint" />
            <p className="text-[12px] leading-relaxed text-muted">
              登录后可同步
              <br />
              对话历史
            </p>
          </div>
        ) : conversations.length === 0 ? (
          <p className="px-3 py-4 text-center text-[12px] leading-relaxed text-faint">
            还没有对话记录
            <br />
            发起第一条提问吧
          </p>
        ) : (
          conversations.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-current={activeConv === c.id ? "page" : undefined}
              onClick={() => void openConversation(c.id)}
              title={c.preview}
              className={cn(
                "flex shrink-0 cursor-pointer flex-col gap-0.5 rounded-lg px-3 py-2 text-left transition-colors",
                activeConv === c.id
                  ? "bg-card font-medium shadow-sm"
                  : "hover:bg-card/60",
              )}
            >
              <span
                className={cn(
                  "truncate text-[13px]",
                  activeConv === c.id ? "text-primary" : "text-ink-2",
                )}
              >
                {c.title}
              </span>
              <span className="truncate text-[11px] text-faint">{c.preview}</span>
            </button>
          ))
        )}
      </div>
    </aside>
  );

  const researchPanel =
    researchWorkflow || researchActive ? (
      <aside className="hidden h-screen w-80 shrink-0 overflow-y-auto border-l border-line bg-sidebar p-4 xl:block">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-ink">研究流程</p>
            <p className="mt-1 text-[11px] text-faint">
              {researchActive ? "正在检索、分析并组织回答" : "本轮研究已完成"}
            </p>
          </div>
          {researchActive && (
            <span className="size-2 animate-pulse rounded-full bg-primary" />
          )}
        </div>
        <WorkflowTrace
          workflow={researchWorkflow}
          active={researchActive}
        />
      </aside>
    ) : null;

  if (messages.length === 0) {
    return (
      <>
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
        <LoginModal open={showLogin} onClose={() => setShowLogin(false)} />
      </>
    );
  }

  return (
    <>
      <div className="flex">
        {historyPanel}
        <div className="flex h-screen min-w-0 flex-1 flex-col">
          {/* 会话头:首问作标题 + 分享 */}
          <div className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-card px-6">
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
              {messages.find((m) => m.role === "user")?.content ?? "对话"}
            </span>
            <button
              type="button"
              title="分享对话链接"
              onClick={() =>
                copyText(
                  activeConv
                    ? `${window.location.origin}/agents?conv=${encodeURIComponent(activeConv)}`
                    : window.location.href,
                  "分享链接已复制",
                )
              }
              className="cursor-pointer rounded-lg p-2 text-muted transition-colors hover:bg-chip hover:text-ink"
            >
              <Share2 className="size-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
              {messages.map((msg) => (
                <MessageRow key={msg.id} msg={msg} />
              ))}
              <div ref={bottomRef} />
            </div>
          </div>
          <div className="px-6 pb-5">
            {streaming && (
              <div className="mx-auto mb-2 flex max-w-5xl justify-center">
                <button
                  type="button"
                  onClick={stopStreaming}
                  className="flex cursor-pointer items-center gap-1.5 rounded-full border border-line bg-card px-3.5 py-1.5 text-[13px] text-muted shadow-sm transition-colors hover:border-primary/40 hover:text-primary"
                >
                  <CircleStop className="size-3.5" />
                  停止生成
                </button>
              </div>
            )}
            <div className="mx-auto max-w-5xl">{composer}</div>
          </div>
        </div>
        {researchPanel}
      </div>
      <LoginModal open={showLogin} onClose={() => setShowLogin(false)} />
    </>
  );
}
