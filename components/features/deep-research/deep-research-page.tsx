"use client";

import { useEffect, useState } from "react";
import { drReport } from "@/lib/data/deep-research";
import { DeepResearchHome } from "./deep-research-home";
import { ResearchWorkbench } from "./research-workbench";

/**
 * Deep Research 页主体 —— 视图机:home(入口态)/ session(双栏工作台)
 * URL 参数(客户端解析,沿用 research-board 惯例,规避 useSearchParams 的 Suspense 约束):
 *   ?mode=instant  直接完成态(headless 截图稳定;与 autostart 并存时优先)
 *   ?autostart=1   进入 session 从头播放(演示)
 *   ?q=xxx         预填问题并进入 session 播放;空串则停留 home
 */
export function DeepResearchPageClient() {
  const [view, setView] = useState<"home" | "session">("home");
  const [question, setQuestion] = useState(drReport.question);
  const [instant, setInstant] = useState(false);
  /** 每次进入 session 自增:重挂载工作台,运行从头播放 */
  const [sessionKey, setSessionKey] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") === "instant") {
      setInstant(true);
      setView("session");
    } else if (params.get("autostart")) {
      setView("session");
    } else {
      const q = params.get("q");
      if (q?.trim()) {
        setQuestion(q);
        setView("session");
      }
    }
  }, []);

  const startResearch = (q: string) => {
    setQuestion(q);
    setInstant(false);
    setSessionKey((k) => k + 1);
    setView("session");
  };

  const openHistory = () => {
    setInstant(true);
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
      onBack={() => {
        setInstant(false);
        setView("home");
      }}
    />
  );
}
