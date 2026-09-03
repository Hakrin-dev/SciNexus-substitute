"use client";

import Link from "next/link";
import { ArrowRight, BookOpenCheck, Bot, Clock3, FolderKanban, Plus, Sparkles } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { useProjects } from "@/lib/api/services";

export default function ProjectsIndexPage() {
  const { data: projects = [], isLoading } = useProjects();
  const active = projects.filter((project) => project.status === "进行中");
  const archived = projects.length - active.length;
  return <AppShell><main className="mx-auto max-w-[1220px] space-y-7 px-5 py-7 sm:px-8">
    <section className="relative overflow-hidden rounded-3xl border border-primary/15 bg-card p-7 shadow-card sm:p-9">
      <div className="absolute -right-16 -top-20 size-64 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative flex flex-wrap items-end justify-between gap-6"><div className="max-w-2xl">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary"><Sparkles className="size-3.5" />研究全流程空间</span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-ink sm:text-3xl">课题工作台</h1>
        <p className="mt-2 text-sm leading-6 text-muted">把问题、大纲、检索记录、实验过程与最终报告放在同一个可追溯空间，让自动研究与人工判断持续衔接。</p>
      </div><Link href="/projects/new" className="flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-white shadow-sm transition-transform hover:-translate-y-0.5"><Plus className="size-4" />新建研究课题</Link></div>
      <div className="relative mt-7 grid gap-3 sm:grid-cols-3"><Stat icon={FolderKanban} label="进行中的课题" value={active.length} /><Stat icon={Bot} label="自动研究流程" value="8 阶段" /><Stat icon={BookOpenCheck} label="已归档课题" value={archived} /></div>
    </section>
    <section><div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-bold text-ink">研究空间</h2><p className="mt-1 text-xs text-muted">选择一个课题继续研究，公共示例可直接浏览完整流程。</p></div>{archived > 0 && <Link href="/my-projects" className="text-xs text-primary hover:underline">查看归档</Link>}</div>
      {isLoading && projects.length === 0 ? <div className="rounded-2xl bg-card p-10 text-center text-sm text-muted shadow-card">正在载入课题…</div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {active.map((project) => <Link key={project.id} href={`/projects/${project.id}`} className="group flex min-h-56 flex-col rounded-2xl border border-line bg-card p-5 shadow-card transition hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg">
          <div className="flex items-start justify-between gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary"><FolderKanban className="size-5" /></span><span className="rounded-full bg-success/10 px-2.5 py-1 text-[10px] font-medium text-success">{project.id === "scinexus" ? "公共示例" : project.status}</span></div>
          <h3 className="mt-4 text-[15px] font-bold text-ink group-hover:text-primary">{project.name}</h3><p className="mt-1.5 line-clamp-2 text-xs leading-5 text-muted">{project.tagline || "从研究问题开始构建自动研究流程"}</p>
          <div className="mt-auto pt-5"><div className="mb-2 flex justify-between text-[11px] text-faint"><span className="flex items-center gap-1"><Clock3 className="size-3" />{project.createdAt}</span><span>{project.progress}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-chip"><div className="h-full rounded-full bg-primary" style={{ width: `${project.progress}%` }} /></div><div className="mt-4 flex items-center justify-between text-xs text-primary"><span>{project.id === "scinexus" ? "查看示例研究记录" : "进入研究工作台"}</span><ArrowRight className="size-4 transition-transform group-hover:translate-x-1" /></div></div>
        </Link>)}
        <Link href="/projects/new" className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-card/50 p-5 text-center transition hover:border-primary/40 hover:bg-primary-soft/30"><span className="flex size-11 items-center justify-center rounded-xl bg-chip text-primary"><Plus className="size-5" /></span><p className="mt-3 text-sm font-semibold text-ink">创建新的研究空间</p><p className="mt-1 text-xs text-muted">定义目标后启动自动研究闭环</p></Link>
      </div>}
    </section>
  </main></AppShell>;
}

function Stat({ icon: Icon, label, value }: { icon: typeof FolderKanban; label: string; value: string | number }) {
  return <div className="flex items-center gap-3 rounded-2xl bg-panel/80 px-4 py-3"><span className="flex size-9 items-center justify-center rounded-xl bg-card text-primary"><Icon className="size-4" /></span><div><p className="text-lg font-bold text-ink">{value}</p><p className="text-[11px] text-muted">{label}</p></div></div>;
}
