"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  CircleStop,
  Loader2,
  Share,
  Sparkles,
  Star,
  XCircle,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SoonButton } from "@/components/ui/soon-button";
import { LoginModal } from "@/components/auth/login-modal";
import { cn } from "@/lib/utils";
import { copyText } from "@/stores/toast";
import { streamChat, ApiError } from "@/lib/api/client";
import {
  formatQuickAnswer,
  quickSearchPapers,
  type QuickPaper,
} from "@/lib/api/services";
import { MarkdownView } from "./markdown-view";
import { ReferenceGrid } from "./reference-grid";
import {
  ComposerShell,
  DEFAULT_MODEL,
  type ComposerMode,
  type ModelChoice,
  type StyleChoice,
} from "./composer";
import type { AgentReference } from "@/types";

interface WorkflowStep {
  agent: string;
  action: string;
  status: string;
  tools?: string[];
}
interface Workflow {
  task_id?: string;
  agents?: string[];
  steps: WorkflowStep[];
  status?: string;
}
interface ChatReference {
  title: string;
  authors: string;
  venue: string;
  year?: number | null;
  ccf?: string | null;
  citations?: number;
  match?: string;
}

type Mode = ComposerMode;

interface Turn {
  query: string;
  mode: Mode;
  answer: string;
  papers: QuickPaper[] | null;
  summary: string;
  workflow: Workflow | null;
  refs: ChatReference[] | null;
  busy: boolean;
}

const MOCK_REPLY =
  "回答生成失败，请稍后重试。若持续失败，可能是网络或模型服务暂不可用。";

const DEFAULT_STEPS: WorkflowStep[] = [
  { agent: "scout", action: "", status: "running" },
  { agent: "synthesis", action: "", status: "pending" },
];

function toRefsFromPapers(papers: QuickPaper[]): AgentReference[] {
  return papers.slice(0, 8).map((p, index) => ({
    id: index + 1,
    venue: p.year ? `${p.venue || "arXiv"} · ${p.year}` : p.venue || "arXiv",
    title: p.title,
    author: p.authors || "未知作者",
    citations: `引用 ${p.citations}`,
    tone:
      p.ccf === "A" ? "violet" : p.ccf === "B" ? "amber" : p.ccf === "C" ? "gray" : "green",
  }));
}

function toRefsFromChat(refs: ChatReference[]): AgentReference[] {
  return refs.slice(0, 8).map((r, index) => ({
    id: index + 1,
    venue: r.year ? `${r.venue || "arXiv"} · ${r.year}` : r.venue || "arXiv",
    title: r.title,
    author: r.authors || "未知作者",
    citations: `引用 ${r.citations ?? 0}`,
    tone:
      r.ccf === "A" ? "violet" : r.ccf === "B" ? "amber" : r.ccf === "C" ? "gray" : "green",
  }));
}

function WorkflowTrace({ workflow, active }: { workflow: Workflow | null; active: boolean }) {
  const steps: WorkflowStep[] =
    workflow && workflow.steps.length > 0
      ? workflow.steps
      : DEFAULT_STEPS.map((s) => ({ ...s, status: active ? s.status : "pending" }));
  const currentRunning = steps.some((s) => s.status === "running");

  // 真实耗时秒表(工作流步骤由后端一次性下发,不做假实时进度)
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!active) return;
    const start = Date.now();
    const timer = setInterval(
      () => setElapsed(Math.floor((Date.now() - start) / 1000)),
      1000,
    );
    return () => clearInterval(timer);
  }, [active]);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl bg-panel px-3.5 py-2.5 text-xs">
      <span className="text-faint">智能体工作流</span>
      {steps.map((step, index) => (
        <span key={`${step.agent}-${index}`} className="flex items-center gap-1.5">
          {step.status === "done" ? (
            <CheckCircle2 className="size-3.5 text-success" />
          ) : step.status === "failed" || step.status === "blocked" ? (
            <XCircle className="size-3.5 text-danger" />
          ) : step.status === "running" || (active && index === 0 && !currentRunning) ? (
            <Loader2 className="size-3.5 animate-spin text-primary" />
          ) : (
            <span className="size-3.5 rounded-full border border-line" />
          )}
          <span
            className={cn(
              "font-medium",
              step.status === "done"
                ? "text-ink"
                : step.status === "running"
                  ? "text-primary"
                  : "text-muted",
            )}
          >
            {step.agent}
          </span>
        </span>
      ))}
      {active && (
        <span className="text-faint">
          已运行 {elapsed}s · 通常需要 10~30s
        </span>
      )}
    </div>
  );
}

/**
 * 深度搜索页 —— 支持快速 / 深度两种模式（右下角切换）：
 * - 快速：/api/search 本地直检 + 后端简易回答（秒级，默认，发现页入口）
 * - 深度：/api/chat/stream 完整多智能体工作流（scout→synthesis→LLM 组合回答）
 * 切换模式影响下一句提问。
 */
export function DeepSearchResults({
  resetSignal = 0,
}: {
  /** 每次「开启新研究」递增，触发本组件清空会话状态 */
  resetSignal?: number;
}) {
  const params = useSearchParams();
  const query = (params.get("q") ?? "").trim();

  const [turns, setTurns] = useState<Turn[]>([]);
  const [value, setValue] = useState("");
  const [mode, setMode] = useState<Mode>("fast");
  const [model, setModel] = useState<ModelChoice>(DEFAULT_MODEL);
  const [style, setStyle] = useState<StyleChoice | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** 深度模式 401 时的内嵌登录弹窗 */
  const [showLogin, setShowLogin] = useState(false);
  const startedRef = useRef<string | null>(null);
  const turnsRef = useRef<Turn[]>([]);
  /** 当前流式请求中止控制器(卸载/停止生成时断流) */
  const abortRef = useRef<AbortController | null>(null);

  // 卸载时中止进行中的流
  useEffect(() => () => abortRef.current?.abort(), []);

  // 「开启新研究」：清空会话状态，回到空对话态
  useEffect(() => {
    if (resetSignal === 0) return;
    setTurns([]);
    setValue("");
    setMode("fast");
    setConversationId(null);
    setBusy(false);
    startedRef.current = null;
    turnsRef.current = [];
  }, [resetSignal]);

  useEffect(() => {
    turnsRef.current = turns;
  }, [turns]);

  const updateLast = useCallback((patch: Partial<Turn>) => {
    setTurns((prev) =>
      prev.map((turn, index) =>
        index === prev.length - 1 ? { ...turn, ...patch } : turn,
      ),
    );
  }, []);

  const runTurn = useCallback(
    async (q: string, m: Mode) => {
      if (!q || busy) return;
      setTurns((prev) => [
        ...prev,
        { query: q, mode: m, answer: "", papers: null, summary: "", workflow: null, refs: null, busy: true },
      ]);
      setBusy(true);
      const ac = new AbortController();
      abortRef.current = ac;
      try {
        if (m === "fast") {
          const { papers, summary, conversationId: returnedConversationId } = await quickSearchPapers(q, conversationId ?? undefined);
          if (returnedConversationId) setConversationId(returnedConversationId);
          updateLast({
            papers,
            summary,
            answer: formatQuickAnswer(q, papers, summary),
            busy: false,
          });
        } else {
          // 深度：完整工作流，历史为前面已完成的回合
          const history = turnsRef.current
            .filter((t) => t.answer)
            .flatMap((t) => [
              { role: "user" as const, content: t.query },
              { role: "assistant" as const, content: t.answer },
            ]);
          let acc = "";
          let lastFlush = 0;
          for await (const event of streamChat("/api/chat/stream", {
            message: q,
            messages: history,
            model,
            mode: m,
            style: style ?? undefined,
            conversation_id: conversationId ?? undefined,
            context: { topic: turnsRef.current[0]?.query ?? q },
          }, ac.signal)) {
            if (event.type === "meta") {
              if (event.meta.conversation_id) setConversationId(event.meta.conversation_id);
              updateLast({
                workflow: (event.meta.workflow as Workflow | null) ?? null,
                refs: (event.meta.references as ChatReference[] | null) ?? null,
              });
            } else if (event.type === "delta") {
              acc += event.text;
              // 节流刷新(~60ms)
              const now = Date.now();
              if (now - lastFlush >= 60) {
                lastFlush = now;
                if (acc) updateLast({ answer: acc });
              }
            }
          }
          if (acc) {
            updateLast({ answer: acc, busy: false });
          } else if (!ac.signal.aborted) {
            updateLast({ answer: "（本轮未生成回答，请重试或换一种问法）", busy: false });
          }
        }
      } catch (e) {
        // 用户主动停止:保留已生成部分
        if (!ac.signal.aborted) {
          if (e instanceof ApiError && e.status === 401) {
            updateLast({
              answer: "深度研究需要登录后使用，请先登录。",
              busy: false,
            });
            setShowLogin(true);
          } else {
            updateLast({ answer: MOCK_REPLY, busy: false });
          }
        }
      } finally {
        if (abortRef.current === ac) abortRef.current = null;
        setBusy(false);
      }
    },
    [busy, updateLast],
  );

  // 发现页入口:尊重 URL mode 参数(默认快速),避免「入口叫深度、落地跑快速」的错位
  const urlMode = (params.get("mode") === "deep" ? "deep" : "fast") as Mode;
  useEffect(() => {
    if (query && startedRef.current !== query) {
      startedRef.current = query;
      void runTurn(query, urlMode);
    }
  }, [query, runTurn, urlMode]);

  const send = (forceMode?: Mode) => {
    const q = value.trim();
    if (!q || busy) return;
    setValue("");
    void runTurn(q, forceMode ?? mode);
  };

  return (
    <div className="space-y-5">
      {/* 会话顶栏 */}
      <div className="flex items-center gap-2.5">
        <span className="size-2 rounded-full bg-success" />
        <h1 className="text-sm font-medium text-ink">
          {turns[0]?.query || query || "深度搜索"}
        </h1>
        <span className="text-xs text-faint">深度研究 · {mode === "deep" ? "深度模式" : "快速模式"}</span>
        <div className="ml-auto flex gap-2">
          <SoonButton tip="Pro 模式：即将上线" variant="dark" size="sm" className="rounded-lg">
            <Star className="size-3.5 fill-brand-violet text-brand-violet" />
            Pro 模式
          </SoonButton>
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg"
            onClick={() => void copyText(window.location.href, "分享链接已复制")}
          >
            <Share className="size-3.5" />
            分享
          </Button>
        </div>
      </div>

      {/* 对话回合 */}
      {turns.length === 0 ? (
        <div className="rounded-2xl bg-card p-12 text-center text-sm text-faint shadow-card">
          {query ? "正在准备检索任务…" : "在发现页输入问题，回车进入深度搜索结果"}
        </div>
      ) : (
        turns.map((turn, index) => (
          <section key={index} className="space-y-4">
            {/* 你的提问 */}
            <div>
              <p className="text-xs text-faint">
                {turn.mode === "deep" ? "你的提问 · 深度模式" : "你的提问 · 快速模式"}
              </p>
              <p className="mt-1.5 text-lg font-semibold leading-relaxed text-ink">
                {turn.query}
              </p>
            </div>

            {/* 工作流/模式标签 */}
            {turn.mode === "deep" ? (
              <WorkflowTrace workflow={turn.workflow} active={turn.busy} />
            ) : (
              <div className="flex items-center gap-1.5 rounded-xl bg-panel px-3.5 py-2 text-xs text-muted">
                <Zap className="size-3.5 text-primary" />
                快速模式 · 本地索引直检（scout：三路 RRF 融合检索）
              </div>
            )}

            {/* AI 回答 */}
            <article className="rounded-2xl bg-card p-6 shadow-card">
              <div className="flex items-center gap-2.5 border-b border-line pb-4">
                <span className="flex size-8 items-center justify-center rounded-full bg-primary">
                  <Sparkles className="size-4 text-white" />
                </span>
                <span className="text-sm font-semibold text-ink">
                  研枢 AI · {turn.mode === "deep" ? "深度研究" : "快速检索"}
                </span>
                {turn.busy && (
                  <span className="flex items-center gap-1.5 text-xs text-faint">
                    <Loader2 className="size-3 animate-spin" />
                    {turn.mode === "deep" ? "深度生成中" : "检索中"}
                  </span>
                )}
              </div>
              <div className="mt-4">
                {turn.answer ? (
                  <MarkdownView content={turn.answer} />
                ) : (
                  <span className="flex items-center gap-2 text-sm text-faint">
                    <Loader2 className="size-4 animate-spin text-primary" />
                    {turn.mode === "deep"
                      ? "正在检索论文并综合回答…"
                      : `正在检索「${turn.query}」的相关论文…`}
                  </span>
                )}
              </div>
            </article>

            {/* 参考来源 */}
            {turn.refs && turn.refs.length > 0 ? (
              <ReferenceGrid refs={toRefsFromChat(turn.refs)} />
            ) : turn.papers && turn.papers.length > 0 ? (
              <ReferenceGrid refs={toRefsFromPapers(turn.papers)} />
            ) : null}
          </section>
        ))
      )}

      {/* 追问输入框（模式切换对下一句生效） */}
      <div className="sticky bottom-4">
        {busy && (
          <div className="mb-2 flex justify-center">
            <button
              type="button"
              onClick={() => abortRef.current?.abort()}
              className="flex cursor-pointer items-center gap-1.5 rounded-full border border-line bg-card px-3.5 py-1.5 text-[13px] text-muted shadow-sm transition-colors hover:border-primary/40 hover:text-primary"
            >
              <CircleStop className="size-3.5" />
              停止生成
            </button>
          </div>
        )}
        <ComposerShell
          value={value}
          onChange={setValue}
          onSend={() => send()}
          onSearchPapers={() => send("fast")}
          mode={mode}
          onModeChange={setMode}
          model={model}
          onModelChange={setModel}
          style={style}
          onStyleChange={setStyle}
          placeholder={
            busy
              ? "正在生成回答，请稍候…"
              : mode === "deep"
                ? "深度模式：继续提问，将运行完整多智能体工作流…"
                : "快速模式：继续提问，将进行本地检索…"
          }
          menuPlacement="up"
        />
        <p className="mt-2 text-[11px] text-faint">
          快速=本地检索+简易回答（秒级）· 深度=完整多智能体工作流（10~30s）
        </p>
      </div>
      <LoginModal open={showLogin} onClose={() => setShowLogin(false)} />
    </div>
  );
}