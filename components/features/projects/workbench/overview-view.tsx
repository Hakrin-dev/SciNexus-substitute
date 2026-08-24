"use client";

import {
  ArrowRight,
  BookMarked,
  CalendarDays,
  CheckCircle2,
  Circle,
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
import { Button } from "@/components/ui/button";
import { ProposalGenerator } from "@/components/features/projects/proposal-generator";
import { cn } from "@/lib/utils";
import type { MilestoneStatus, Project } from "@/lib/data/projects";
import type { WorkbenchOverview } from "@/lib/data/workbench";

interface Props {
  project: Project;
  overview: WorkbenchOverview;
  onJump: (view: "outline" | "thread" | "assets" | "log") => void;
}

const STATUS_STYLE: Record<MilestoneStatus, { label: string; className: string }> = {
  done: { label: "已完成", className: "bg-primary-soft text-primary" },
  doing: { label: "进行中", className: "bg-brand-blue-soft text-brand-blue" },
  todo: { label: "未开始", className: "bg-chip text-muted" },
};

function MilestoneIcon({ status }: { status: MilestoneStatus }) {
  if (status === "done") return <CheckCircle2 className="size-4.5 text-primary" />;
  if (status === "doing") return <Loader className="size-4.5 text-brand-blue" />;
  return <Circle className="size-4.5 text-faint" />;
}

/** 概览视图 —— 当前聚焦 / 阻塞项 / AI 建议 + 项目档案(原详情页内容迁移) */
export function OverviewView({ project, overview, onJump }: Props) {
  const doneCount = project.milestones.filter((m) => m.status === "done").length;

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-5">
        {/* 当前聚焦 */}
        <section className="rounded-2xl bg-card p-6 shadow-card">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
            <FlaskConical className="size-4 text-primary" />
            当前聚焦
          </h2>
          <button
            onClick={() => onJump("thread")}
            className="mt-3 flex w-full cursor-pointer items-center gap-3 rounded-xl bg-chip px-4 py-3 text-left transition-colors hover:bg-primary-soft"
          >
            <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-medium text-primary">
              {overview.focus.questionId.toUpperCase()}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
              {overview.focus.question}
            </span>
            <ArrowRight className="size-4 shrink-0 text-faint" />
          </button>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-faint">最近打开的文档</p>
              <ul className="mt-2 space-y-1.5">
                {overview.focus.recentDocs.map((doc) => (
                  <li key={doc} className="flex items-center gap-2 text-[13px] text-muted">
                    <BookMarked className="size-3.5 shrink-0 text-faint" />
                    <span className="truncate">{doc}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-medium text-faint">进行中的实验</p>
              <ul className="mt-2 space-y-1.5">
                {overview.focus.runningExperiments.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-[13px] text-muted">
                    <Loader className="size-3.5 shrink-0 animate-spin text-brand-blue" />
                    <span className="truncate">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* 阻塞项 */}
        <section className="rounded-2xl bg-card p-6 shadow-card">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
            <TriangleAlert className="size-4 text-brand-blue" />
            阻塞项
          </h2>
          <ul className="mt-3 space-y-2">
            {overview.blockers.map((blocker) => (
              <li key={blocker.id}>
                <button
                  onClick={() => onJump(blocker.view)}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-dashed border-line px-4 py-2.5 text-left transition-colors hover:bg-chip"
                >
                  <span className="size-1.5 shrink-0 rounded-full bg-brand-blue" />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{blocker.text}</span>
                  <span className="shrink-0 text-[11px] text-faint">前往{VIEW_LABELS[blocker.view]} →</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* 项目档案(原详情页内容) */}
        <section className="rounded-2xl bg-card p-6 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-ink">项目简介</h2>
            <div className="flex gap-2">
              <ProposalGenerator projectName={project.name} />
              <Button variant="outline" size="sm">
                编辑
              </Button>
              <Button variant="outline" size="sm">
                项目设置
              </Button>
            </div>
          </div>
          {project.overview.map((paragraph, i) => (
            <p key={i} className="mt-3 text-sm leading-relaxed text-muted">
              {paragraph}
            </p>
          ))}
          <div className="mt-4 flex flex-wrap gap-2.5">
            {project.techStack.map((tech) => (
              <span key={tech} className="rounded-lg bg-chip px-3 py-1.5 text-xs text-muted">
                {tech}
              </span>
            ))}
          </div>

          <h3 className="mt-6 text-[15px] font-semibold text-ink">
            里程碑
            <span className="ml-2 text-xs font-normal text-faint">
              {doneCount}/{project.milestones.length}
            </span>
          </h3>
          <ul className="mt-3 space-y-1">
            {project.milestones.map((m) => (
              <li
                key={m.title}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-chip"
              >
                <MilestoneIcon status={m.status} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">{m.title}</p>
                  <p className="mt-0.5 text-xs text-muted">{m.detail}</p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
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

      {/* 右列:信息 / 成员 / 链接 */}
      <aside className="space-y-5">
        <section className="rounded-2xl bg-card p-6 shadow-card">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
            <Lightbulb className="size-4 text-primary" />
            AI 建议
          </h2>
          <ul className="mt-3 space-y-2">
            {overview.suggestions.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => onJump(item.view)}
                  className="w-full cursor-pointer rounded-xl bg-primary-soft/60 px-4 py-3 text-left text-[13px] leading-relaxed text-ink transition-colors hover:bg-primary-soft"
                >
                  {item.text}
                  <span className="mt-1 block text-[11px] text-faint">前往{VIEW_LABELS[item.view]} →</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl bg-card p-5 shadow-card">
          <h3 className="text-[15px] font-semibold text-ink">项目信息</h3>
          <ul className="mt-3 space-y-2.5 text-[13px]">
            <li className="flex items-center gap-2.5 text-muted">
              <UserRound className="size-4 text-faint" />
              负责人
              <span className="ml-auto text-ink">{project.owner}</span>
            </li>
            <li className="flex items-center gap-2.5 text-muted">
              <CalendarDays className="size-4 text-faint" />
              创建时间
              <span className="ml-auto text-ink">{project.createdAt}</span>
            </li>
          </ul>
        </section>

        <section className="rounded-2xl bg-card p-5 shadow-card">
          <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
            <Users className="size-4 text-muted" />
            成员
            <span className="text-xs font-normal text-faint">{project.members.length} 人</span>
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
          <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
            <Link2 className="size-4 text-muted" />
            相关链接
          </h3>
          <ul className="mt-3 space-y-2.5">
            {project.links.map((link) => {
              const Icon = link.label.includes("GitHub") || link.label.includes("GHCR") ? Github : Globe;
              return (
                <li key={link.label}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2.5 text-[13px] text-ink-2 transition-colors hover:text-primary"
                  >
                    <Icon className="size-4 shrink-0 text-muted" />
                    {link.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      </aside>
    </div>
  );
}

const VIEW_LABELS = {
  outline: "大纲",
  thread: "线程",
  assets: "资产库",
  log: "日志",
} as const;
