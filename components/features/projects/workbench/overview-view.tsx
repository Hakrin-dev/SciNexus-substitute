"use client";

import {
  ArrowRight,
  BookMarked,
  CheckCircle2,
  Circle,
  Compass,
  FlaskConical,
  Github,
  Globe,
  Lightbulb,
  Link2,
  Loader,
  TriangleAlert,
  UserRound,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { MilestoneStatus, Project } from "@/lib/data/projects";
import type { JumpableView, WorkbenchOverview } from "@/lib/data/workbench";

interface Props {
  project: Project;
  overview: WorkbenchOverview;
  onJump: (view: JumpableView) => void;
}

const STATUS_STYLE: Record<MilestoneStatus, { label: string; className: string }> = {
  done: { label: "已完成", className: "bg-primary-soft text-primary" },
  doing: { label: "进行中", className: "bg-brand-blue-soft text-brand-blue" },
  todo: { label: "未开始", className: "bg-chip text-muted" },
};

const VIEW_LABELS = {
  outline: "大纲",
  thread: "线程",
  assets: "资产库",
  log: "日志",
} as const;

function SectionHeader({
  icon: Icon,
  tone,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  tone: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", tone)}>
        <Icon className="size-5" strokeWidth={1.8} />
      </span>
      <div>
        <h2 className="text-[15px] font-bold text-ink">{title}</h2>
        <p className="mt-0.5 text-xs text-muted">{description}</p>
      </div>
    </div>
  );
}

/** 概览视图 —— 指标瓦片 + 当前聚焦 / 阻塞项 / AI 建议 + 项目档案 */
export function OverviewView({ project, overview, onJump }: Props) {
  const doneCount = project.milestones.filter((m) => m.status === "done").length;

  const metrics = [
    { value: String(project.milestones.length), label: `里程碑 · 已完成 ${doneCount}` },
    { value: String(project.members.length), label: "项目成员" },
    { value: String(overview.blockers.length), label: "待解决阻塞项" },
    { value: String(overview.suggestions.length), label: "AI 建议" },
  ];

  return (
    <div className="space-y-5">
      {/* 指标瓦片 */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {metrics.map((metric, index) => (
          <div
            key={metric.label}
            className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both min-w-0 rounded-xl border border-line/70 bg-panel px-4 py-3 duration-300"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <p className="text-lg font-bold tracking-tight text-ink">{metric.value}</p>
            <p className="mt-0.5 truncate text-[11px] text-faint">{metric.label}</p>
          </div>
        ))}
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          {/* 当前聚焦 */}
          <section className="rounded-2xl bg-card p-6 shadow-card">
            <SectionHeader
              icon={FlaskConical}
              tone="bg-primary-soft text-primary"
              title="当前聚焦"
              description="正在推进的研究问题与进行中的工作"
            />
            <button
              onClick={() => onJump("thread")}
              className="group mt-4 flex w-full cursor-pointer items-center gap-3 rounded-xl bg-panel px-4 py-3.5 text-left transition-all hover:-translate-y-0.5 hover:bg-primary-soft hover:shadow-pop"
            >
              <span className="rounded-full bg-primary-soft px-2.5 py-1 text-[11px] font-medium text-primary group-hover:bg-card">
                {overview.focus.questionId.toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                {overview.focus.question}
              </span>
              <ArrowRight className="size-4 shrink-0 text-faint transition-colors group-hover:text-primary" />
            </button>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-panel p-4">
                <p className="flex items-center gap-2 text-xs font-semibold text-ink-2">
                  <BookMarked className="size-4 text-primary" strokeWidth={1.8} />
                  最近打开的文档
                </p>
                <ul className="mt-2.5 space-y-1.5">
                  {overview.focus.recentDocs.map((doc) => (
                    <li key={doc} className="truncate text-[13px] text-muted">
                      {doc}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl bg-panel p-4">
                <p className="flex items-center gap-2 text-xs font-semibold text-ink-2">
                  <Loader className="size-4 animate-spin text-brand-blue" strokeWidth={1.8} />
                  进行中的实验
                </p>
                <ul className="mt-2.5 space-y-1.5">
                  {overview.focus.runningExperiments.map((item) => (
                    <li key={item} className="truncate text-[13px] text-muted">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* 阻塞项 */}
          <section className="rounded-2xl bg-card p-6 shadow-card">
            <SectionHeader
              icon={TriangleAlert}
              tone="bg-brand-blue/10 text-brand-blue"
              title="阻塞项"
              description="缺少数据、待确认的假设、卡住的任务"
            />
            <ul className="mt-4 space-y-2">
              {overview.blockers.map((blocker) => (
                <li key={blocker.id}>
                  <button
                    onClick={() => onJump(blocker.view)}
                    className="group flex w-full cursor-pointer items-center gap-3 rounded-xl border border-dashed border-line px-4 py-3 text-left transition-colors hover:border-primary/40 hover:bg-panel"
                  >
                    <span className="size-1.5 shrink-0 rounded-full bg-brand-blue" />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{blocker.text}</span>
                    <span className="shrink-0 text-[11px] text-faint transition-colors group-hover:text-primary">
                      前往{VIEW_LABELS[blocker.view]}
                      <ArrowRight className="ml-0.5 inline size-3" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {/* 项目档案 */}
          <section className="rounded-2xl bg-card p-6 shadow-card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <SectionHeader
                icon={Compass}
                tone="bg-chip text-muted"
                title="项目档案"
                description={`负责人 ${project.owner} · 创建于 ${project.createdAt}`}
              />
            <div className="flex gap-2">
              <button className="flex h-8 items-center gap-1.5 rounded-lg border border-line bg-card px-3 text-xs font-medium text-ink-2 shadow-card transition-colors hover:bg-chip hover:text-primary">
                编辑
              </button>
              <button className="flex h-8 items-center gap-1.5 rounded-lg border border-line bg-card px-3 text-xs font-medium text-ink-2 shadow-card transition-colors hover:bg-chip hover:text-primary">
                项目设置
              </button>
            </div>
            </div>

            {project.overview.map((paragraph, i) => (
              <p key={i} className="mt-3 text-sm leading-relaxed text-muted">
                {paragraph}
              </p>
            ))}

            <h3 className="mt-6 text-sm font-bold text-ink">里程碑</h3>
            <ul className="mt-2 divide-y divide-line/70">
              {project.milestones.map((m) => (
                <li key={m.title} className="flex items-center gap-3 py-2.5">
                  {m.status === "done" ? (
                    <CheckCircle2 className="size-4.5 shrink-0 text-primary" />
                  ) : m.status === "doing" ? (
                    <Loader className="size-4.5 shrink-0 animate-spin text-brand-blue" />
                  ) : (
                    <Circle className="size-4.5 shrink-0 text-faint" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-ink">{m.title}</p>
                    <p className="mt-0.5 truncate text-xs text-muted">{m.detail}</p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                      STATUS_STYLE[m.status].className,
                    )}
                  >
                    {STATUS_STYLE[m.status].label}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* 右列:AI 建议 / 成员 / 链接 */}
        <aside className="space-y-5">
          <section className="overflow-hidden rounded-2xl bg-card shadow-card">
            <div className="flex items-center gap-2.5 border-b border-line/70 px-5 py-3.5">
              <Lightbulb className="size-4 text-primary" strokeWidth={1.8} />
              <h2 className="text-sm font-bold text-ink">AI 建议</h2>
              <span className="ml-auto text-[10px] text-faint">由系统聚合生成</span>
            </div>
            <ul className="space-y-2 p-3">
              {overview.suggestions.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => onJump(item.view)}
                    className="w-full cursor-pointer rounded-xl bg-panel px-3.5 py-3 text-left text-xs leading-relaxed text-ink transition-all hover:-translate-y-0.5 hover:bg-primary-soft hover:shadow-pop"
                  >
                    {item.text}
                    <span className="mt-1 block text-[10px] text-faint">
                      前往{VIEW_LABELS[item.view]} →
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl bg-card p-5 shadow-card">
            <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
              <Users className="size-4 text-muted" strokeWidth={1.8} />
              成员
              <span className="text-[11px] font-normal text-faint">{project.members.length} 人</span>
            </h3>
            <ul className="mt-3 space-y-2.5">
              {project.members.map((member) => (
                <li key={member.name} className="flex items-center gap-2.5">
                  <span className="flex size-8 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
                    {member.name.slice(0, 1)}
                  </span>
                  <span className="flex-1 text-[13px] text-ink">{member.name}</span>
                  <span className="text-xs text-faint">{member.role}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl bg-card p-5 shadow-card">
            <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
              <Link2 className="size-4 text-muted" strokeWidth={1.8} />
              相关链接
            </h3>
            <ul className="mt-3 space-y-2.5">
              {project.links.map((link) => {
                const Icon =
                  link.label.includes("GitHub") || link.label.includes("GHCR") ? Github : Globe;
                return (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2.5 text-[13px] text-ink-2 transition-colors hover:text-primary"
                    >
                      <Icon className="size-4 shrink-0 text-muted" strokeWidth={1.8} />
                      {link.label}
                    </a>
                  </li>
                );
              })}
            </ul>
          </section>

          <div className="flex items-center gap-2 rounded-2xl border border-line/70 bg-panel px-4 py-3 text-[11px] leading-relaxed text-faint">
            <UserRound className="size-3.5 shrink-0" />
            所有视图共享同一套研究资产,操作自动同步。
          </div>
        </aside>
      </div>
    </div>
  );
}
