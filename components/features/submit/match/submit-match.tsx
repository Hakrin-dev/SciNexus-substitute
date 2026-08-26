"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VenueCard } from "@/components/features/submit/venue-card";
import { matchVenues } from "@/lib/api/services";
import { toast } from "@/stores/toast";
import { cn } from "@/lib/utils";
import type { MatchedVenue } from "@/types";

/**
 * 投稿匹配页 `/submit/match` —— 粘贴标题/摘要,获取 Top5 会议/期刊推荐。
 * useLlm 开启时后端走 LLM 语义匹配(未配置或失败自动回退关键词),实际模式以响应为准。
 */

const SAMPLES = [
  {
    title: "Efficient Diffusion Policy for Real-Time Robot Manipulation",
    abstract:
      "We propose an efficient diffusion-based policy that reduces inference latency by 3x while matching state-of-the-art success rates on 5 manipulation benchmarks. A chunk-wise consistency distillation enables 60Hz control on consumer GPUs.",
    keywords: "diffusion policy, robot manipulation, inference optimization",
  },
  {
    title: "面向图数据的异常检测:方法综述与基准",
    abstract:
      "本文系统梳理图异常检测的主流方法,从谱方法到图神经网络,并在六个公开数据集上建立统一基准,分析各类方法的召回-效率权衡。",
    keywords: "graph, anomaly detection, survey",
  },
];

const CLASS_STYLE: Record<MatchedVenue["matchClass"], { chip: string; label: string }> = {
  high: { chip: "bg-success-soft text-success", label: "高匹配" },
  mid: {
    chip: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
    label: "较匹配",
  },
  low: { chip: "bg-chip text-muted", label: "一般" },
};

/** 匹配结果卡 = 匹配条 + 复用 VenueCard */
function MatchedVenueCard({
  venue,
  index,
}: {
  venue: MatchedVenue;
  index: number;
}) {
  const cls = CLASS_STYLE[venue.matchClass];
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl shadow-card",
        index === 0 && "ring-1 ring-brand-blue/40",
      )}
    >
      {/* 匹配条 */}
      <div className="flex items-center gap-3 border-b border-line bg-panel px-6 py-3">
        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", cls.chip)}>
          {cls.label}
        </span>
        <span className="text-lg font-bold tabular-nums text-ink">{venue.matchPct}%</span>
        <span className="min-w-0 flex-1 truncate text-xs text-muted">{venue.matchReason}</span>
        {index === 0 && (
          <span className="shrink-0 rounded-full bg-brand-blue/10 px-2 py-0.5 text-[11px] font-medium text-brand-blue">
            最佳匹配
          </span>
        )}
      </div>
      <div className="[&>article]:rounded-t-none">
        <VenueCard venue={venue} index={index} />
      </div>
    </div>
  );
}

export function SubmitMatch() {
  const [title, setTitle] = React.useState("");
  const [abstract, setAbstract] = React.useState("");
  const [keywords, setKeywords] = React.useState("");
  const [useLlm, setUseLlm] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [results, setResults] = React.useState<MatchedVenue[] | null>(null);
  const [mode, setMode] = React.useState<"llm" | "keyword">("keyword");

  const keywordList = keywords
    .split(/[,，;；]/)
    .map((k) => k.trim())
    .filter(Boolean);

  const handleMatch = async () => {
    if (busy) return;
    if (!title.trim() && !abstract.trim()) {
      toast.error("请至少填写标题或摘要");
      return;
    }
    setBusy(true);
    setResults(null);
    try {
      const res = await matchVenues(title.trim(), abstract.trim(), keywordList, useLlm);
      setResults(res.data);
      setMode(res.mode);
      if (!res.data.length) toast.info("未找到合适的投稿方向，试试补充更多摘要内容");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "匹配失败，请稍后重试");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1180px] space-y-5 px-8 py-6">
      {/* 返回 + 标题 */}
      <div className="flex items-center gap-4">
        <Link href="/submit" aria-label="返回投稿页" className="rounded-lg p-1 text-faint transition-colors hover:bg-chip hover:text-ink">
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-ink">
            <Sparkles className="size-5 text-primary" />
            AI 投稿匹配
          </h1>
          <p className="mt-0.5 text-xs text-faint">
            粘贴标题与摘要，获取最匹配的 5 个会议 / 期刊推荐
          </p>
        </div>
      </div>

      {/* 表单 */}
      <section className="rounded-2xl bg-card p-6 shadow-card">
        <div className="space-y-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-ink-2">论文标题</span>
            <Input
              placeholder="请输入论文标题"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-ink-2">摘要</span>
            <textarea
              value={abstract}
              onChange={(e) => setAbstract(e.target.value)}
              placeholder="粘贴论文摘要(中英文均可)"
              rows={4}
              className="w-full resize-y rounded-xl border border-line bg-card px-4 py-2.5 text-sm leading-relaxed text-ink outline-none transition-colors placeholder:text-faint focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/15"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-ink-2">
              关键词<span className="ml-1 font-normal text-faint">(可选,逗号分隔)</span>
            </span>
            <Input
              placeholder="如: diffusion policy, robot manipulation"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
            />
          </label>

          <div className="flex items-center justify-between pt-1">
            {/* AI 语义匹配开关 */}
            <button
              type="button"
              role="switch"
              aria-checked={useLlm}
              onClick={() => setUseLlm((v) => !v)}
              title="开启后使用大模型做语义级匹配;未配置模型服务时自动回退关键词匹配"
              className={cn(
                "flex h-8 cursor-pointer items-center gap-2 rounded-full border px-3 text-[13px] transition-colors",
                useLlm
                  ? "border-primary bg-primary-soft font-medium text-primary"
                  : "border-line text-muted hover:bg-chip",
              )}
            >
              <Sparkles className="size-3.5" />
              AI 语义匹配
            </button>

            <Button onClick={handleMatch} disabled={busy} className="min-w-32">
              {busy ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  匹配中…
                </>
              ) : (
                <>
                  开始匹配
                  <ArrowRight className="size-3.5" />
                </>
              )}
            </Button>
          </div>
        </div>

        {/* 示例稿件(尚无结果时显示) */}
        {!results && !busy && (
          <div className="mt-5 border-t border-line pt-4">
            <p className="text-xs text-faint">没有思路?试试示例稿件:</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {SAMPLES.map((s) => (
                <button
                  key={s.title}
                  type="button"
                  onClick={() => {
                    setTitle(s.title);
                    setAbstract(s.abstract);
                    setKeywords(s.keywords);
                  }}
                  className="max-w-md cursor-pointer truncate rounded-full border border-line bg-sidebar px-3.5 py-1.5 text-left text-[13px] text-muted transition-colors hover:border-primary/40 hover:text-primary"
                >
                  {s.title}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* 结果 */}
      {results && (
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-[15px] font-semibold text-ink">
              匹配结果 · {results.length} 个方向
            </h2>
            <span className="rounded-full bg-chip px-2 py-0.5 text-[11px] text-muted">
              {mode === "llm" ? "LLM 语义匹配" : "关键词匹配"}
            </span>
          </div>
          {results.map((v, i) => (
            <MatchedVenueCard key={v.id} venue={v} index={i} />
          ))}
        </section>
      )}
    </div>
  );
}
