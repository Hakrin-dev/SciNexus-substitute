"use client";

import { BookOpenCheck, CheckCircle2, FileText, FlaskConical, Quote } from "lucide-react";
import type { ResearchExperiment, ResearchRun, WorkbenchAsset } from "@/lib/data/workbench";

export function ReportView({ run, assets, experiments }: { run?: ResearchRun; assets: WorkbenchAsset[]; experiments: ResearchExperiment[] }) {
  const reports = assets.filter((asset) => asset.artifact?.metadata?.stage === "report" && (!run || asset.artifact?.runId === run.id));
  const mainReport = reports.find((asset) => asset.title === "report.md")
    ?? reports.find((asset) => asset.title === "report.md")
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

    <article className="rounded-2xl bg-card p-6 shadow-card sm:p-8"><div className="mb-5 flex items-center justify-between border-b border-line pb-4"><div><h3 className="text-base font-bold text-ink">报告正文</h3><p className="mt-1 text-[11px] text-muted">{mainReport?.artifact?.uri || "等待 report.md 产物"}</p></div>{mainReport && <span className="rounded-full bg-panel px-2.5 py-1 text-[10px] text-muted">Markdown</span>}</div>{mainReport?.artifact?.content ? <div className="whitespace-pre-wrap break-words text-[13px] leading-7 text-ink-2">{mainReport.artifact.content}</div> : <div className="py-16 text-center text-sm text-muted">完成自动研究后，最终报告将在这里单独展示。</div>}</article>
  </div>;
}

function Summary({ icon: Icon, label, value }: { icon: typeof CheckCircle2; label: string; value: string }) {
  return <div className="flex items-center gap-3 rounded-xl bg-panel px-3.5 py-3"><span className="flex size-8 items-center justify-center rounded-lg bg-card text-primary"><Icon className="size-4" /></span><div className="min-w-0"><p className="text-[10px] text-faint">{label}</p><p className="truncate text-xs font-semibold text-ink">{value}</p></div></div>;
}
