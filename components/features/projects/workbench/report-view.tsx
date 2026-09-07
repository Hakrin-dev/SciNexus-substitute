"use client";

import { BookOpenCheck, CheckCircle2, FileText, FlaskConical, Layers3, Quote } from "lucide-react";
import type { ResearchExperiment, ResearchRun, WorkbenchAsset } from "@/lib/data/workbench";

export function ReportView({ run, assets, experiments }: { run?: ResearchRun; assets: WorkbenchAsset[]; experiments: ResearchExperiment[] }) {
  const reports = assets.filter((asset) => asset.artifact?.stage === "report" && (!run || asset.artifact?.runId === run.id));
  const runAssets = assets
    .filter((asset) => run && asset.artifact?.runId === run.id)
    .sort((a, b) => STAGE_ORDER.indexOf(a.artifact!.stage) - STAGE_ORDER.indexOf(b.artifact!.stage));
  const mainReport = reports.find((asset) => asset.title === "report.md")
    ?? reports.find((asset) => asset.artifact?.kind === "report")
    ?? reports[0];
  const experiment = [...experiments].sort((a, b) => b.round - a.round)[0];
  const metrics = Object.entries(experiment?.metrics ?? {}).slice(0, 4);

  return <div className="space-y-5">
    <section className="overflow-hidden rounded-2xl border border-primary/15 bg-card shadow-card">
      <div className="bg-gradient-to-r from-primary-soft via-card to-card p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><span className="inline-flex items-center gap-1.5 rounded-full bg-card px-2.5 py-1 text-[11px] text-primary"><BookOpenCheck className="size-3.5" />最终研究报告</span><h2 className="mt-3 text-xl font-bold text-ink">{run?.objective || "研究报告尚未生成"}</h2><p className="mt-2 text-xs text-muted">汇总问题、证据、实验结果、结论与研究边界</p></div><span className="rounded-full bg-success/10 px-3 py-1.5 text-xs font-medium text-success">{run?.status === "completed" ? "已完成" : run ? `${run.progress}%` : "等待运行"}</span></div>
      </div>
      <div className="grid gap-3 border-t border-line p-5 sm:grid-cols-3">
        <Summary icon={CheckCircle2} label="闭环判断" value={run?.decision?.action === "accept" ? "接受结论" : run?.decision?.action || "待判断"} />
        <Summary icon={FlaskConical} label="实验状态" value={experiment?.status || "暂无实验"} />
        <Summary icon={FileText} label="报告产物" value={`${reports.length} 个文件`} />
      </div>
    </section>

    {run?.decision?.reason && <section className="rounded-2xl border-l-4 border-primary bg-primary-soft/40 p-5 shadow-card"><div className="flex items-start gap-3"><Quote className="mt-0.5 size-5 shrink-0 text-primary" /><div><h3 className="text-sm font-bold text-ink">核心结论</h3><p className="mt-1.5 text-sm leading-7 text-muted">{run.decision.reason}</p></div></div></section>}

    {metrics.length > 0 && <section className="rounded-2xl bg-card p-5 shadow-card"><h3 className="text-sm font-bold text-ink">关键实验指标</h3><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{metrics.map(([key, value]) => <div key={key} className="rounded-xl bg-panel p-3"><p className="truncate text-[10px] text-faint">{key}</p><p className="mt-1 text-base font-bold text-ink">{String(value)}</p></div>)}</div></section>}

    {runAssets.length > 0 && <section className="rounded-2xl bg-card p-5 shadow-card"><div className="flex items-center gap-2"><Layers3 className="size-4 text-primary" /><h3 className="text-sm font-bold text-ink">报告依据的研究资产</h3></div><p className="mt-1 text-[11px] text-muted">以下产物与当前报告属于同一次研究运行，可从资产库逐项追溯。</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{runAssets.map((asset) => <div key={asset.id} className="flex items-center gap-3 rounded-xl border border-line px-3.5 py-3"><span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-xs font-bold text-primary">{STAGE_ORDER.indexOf(asset.artifact!.stage) + 1}</span><div className="min-w-0"><p className="truncate text-xs font-semibold text-ink">{asset.title}</p><p className="mt-0.5 text-[10px] text-muted">{STAGE_LABEL[asset.artifact!.stage]}</p></div></div>)}</div></section>}

    <article className="rounded-2xl bg-card p-6 shadow-card sm:p-8"><div className="mb-5 flex items-center justify-between border-b border-line pb-4"><div><h3 className="text-base font-bold text-ink">报告正文</h3><p className="mt-1 text-[11px] text-muted">{mainReport?.artifact?.uri || mainReport?.title || "等待报告产物"}</p></div>{mainReport && <span className="rounded-full bg-panel px-2.5 py-1 text-[10px] text-muted">Markdown</span>}</div>{mainReport?.artifact?.content ? <MarkdownReport content={mainReport.artifact.content} /> : <div className="py-16 text-center text-sm text-muted">完成自动研究后，最终报告将在这里单独展示。</div>}</article>
  </div>;
}

const STAGE_ORDER = ["plan", "search", "read", "synthesize", "design", "code", "run", "report"] as const;
const STAGE_LABEL: Record<(typeof STAGE_ORDER)[number], string> = {
  plan: "01 研究计划", search: "02 文献检索", read: "03 结构化阅读", synthesize: "04 证据综合",
  design: "05 实验设计", code: "06 实验代码", run: "07 实验结果", report: "08 研究报告",
};

function MarkdownReport({ content }: { content: string }) {
  return <div className="space-y-2 text-[13px] leading-7 text-ink-2">{content.split("\n").map((line, index) => {
    const value = line.trim();
    if (!value) return <div key={index} className="h-1" />;
    if (value.startsWith("# ")) return <h1 key={index} className="pb-2 text-xl font-bold text-ink">{value.slice(2)}</h1>;
    if (value.startsWith("## ")) return <h2 key={index} className="pt-4 text-sm font-bold text-ink">{value.slice(3)}</h2>;
    if (value.startsWith("- ")) return <p key={index} className="pl-4 before:mr-2 before:text-primary before:content-['•']">{value.slice(2)}</p>;
    return <p key={index}>{value}</p>;
  })}</div>;
}

function Summary({ icon: Icon, label, value }: { icon: typeof CheckCircle2; label: string; value: string }) {
  return <div className="flex items-center gap-3 rounded-xl bg-panel px-3.5 py-3"><span className="flex size-8 items-center justify-center rounded-lg bg-card text-primary"><Icon className="size-4" /></span><div className="min-w-0"><p className="text-[10px] text-faint">{label}</p><p className="truncate text-xs font-semibold text-ink">{value}</p></div></div>;
}
