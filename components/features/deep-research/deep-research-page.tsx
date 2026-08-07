"use client";

import { useState } from "react";
import { drReport, DR_RUN_TOTAL_MS } from "@/lib/data/deep-research";
import { DeepResearchHome } from "./deep-research-home";
import { ResearchWorkbench } from "./research-workbench";

/**
 * Deep Research 页主体 —— 视图机:home(入口态)/ session(双栏工作台)
 * URL 参数由服务端 page.tsx 透传 props,确保 headless 截图的 SSR HTML 即进入
 * 目标态,无需等待客户端 useEffect:
 *   ?mode=instant  直接完成态(headless 截图稳定;与 autostart 并存时优先)
 *   ?autostart=1   进入 session,固定落在中途进度(适合 headless 截图)
 *   ?q=xxx         预填问题并进入 session 从头播放;空串则停留 home
 */
interface DeepResearchPageClientProps {
  mode?: string | string[];
  autostart?: string | string[];
  q?: string | string[];
  initialElapsedMs?: number;
}

function normalizeString(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function getInitialState(
  props: DeepResearchPageClientProps,
) {
  const fallback = {
    view: "home" as const,
    question: drReport.question,
    instant: false,
    initialElapsedMs: 0,
  };

  const mode = normalizeString(props.mode);
  if (mode === "instant") {
    return {
      ...fallback,
      view: "session" as const,
      instant: true,
      initialElapsedMs: DR_RUN_TOTAL_MS,
    };
  }

  const autostart = normalizeString(props.autostart);
  if (autostart === "1") {
    // 配合 virtual-time-budget=6000,从 7.2s 开始,期望 headless 截图落在中途进度
    return {
      ...fallback,
      view: "session" as const,
      initialElapsedMs: 7200,
    };
  }

  const q = normalizeString(props.q);
  if (q?.trim()) {
    return {
      ...fallback,
      view: "session" as const,
      question: q.trim(),
    };
  }

  return fallback;
}

export function DeepResearchPageClient(props: DeepResearchPageClientProps) {
  const initial = getInitialState(props);
  const [view, setView] = useState<"home" | "session">(initial.view);
  const [question, setQuestion] = useState(initial.question);
  const [instant, setInstant] = useState(initial.instant);
  const [initialElapsedMs, setInitialElapsedMs] = useState(
    initial.initialElapsedMs,
  );
  /** 每次进入 session 自增:重挂载工作台,运行从头播放 */
  const [sessionKey, setSessionKey] = useState(0);

  const startResearch = (q: string) => {
    setQuestion(q);
    setInstant(false);
    setInitialElapsedMs(0);
    setSessionKey((k) => k + 1);
    setView("session");
  };

  const openHistory = () => {
    setQuestion(drReport.question);
    setInstant(true);
    setInitialElapsedMs(DR_RUN_TOTAL_MS);
    setSessionKey((k) => k + 1);
    setView("session");
  };

  if (view === "home") {
    return (
      <DeepResearchHome onStart={startResearch} onOpenHistory={openHistory} />
    );
  }
  return (
    <ResearchWorkbench
      key={sessionKey}
      question={question}
      instant={instant}
      initialElapsedMs={initialElapsedMs}
      onBack={() => {
        setInstant(false);
        setView("home");
      }}
    />
  );
}
