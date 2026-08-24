"use client";

import {
  BookOpen,
  CircleDashed,
  CornerDownRight,
  Database,
  FileSearch,
  FileText,
  Flag,
  FlaskConical,
  HelpCircle,
  Info,
  Lightbulb,
  LineChart,
  Loader,
  NotebookPen,
  Sparkles,
  StickyNote,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type {
  ActivityEntry,
  AssetKind,
  AssetStatus,
  NodeStatus,
  OutlineKind,
  ThreadCard,
  ThreadCardKind,
} from "@/lib/data/workbench";

export interface KindMeta {
  label: string;
  icon: LucideIcon;
  tone: string;
}

/** 大纲节点类型(Q/H/E/C/笔记) */
export const NODE_KIND_META: Record<OutlineKind, KindMeta> = {
  question: { label: "问题", icon: HelpCircle, tone: "bg-primary-soft text-primary" },
  hypothesis: { label: "假设", icon: Lightbulb, tone: "bg-brand-blue-soft text-brand-blue" },
  evidence: { label: "证据", icon: FileSearch, tone: "bg-success-soft text-success" },
  conclusion: { label: "结论", icon: Flag, tone: "bg-ink text-white" },
  note: { label: "笔记", icon: StickyNote, tone: "bg-chip text-muted" },
};

/** 大纲节点状态 */
export const NODE_STATUS_META: Record<NodeStatus, { label: string; className: string }> = {
  open: { label: "待验证", className: "bg-chip text-muted" },
  supported: { label: "已支持", className: "bg-success-soft text-success" },
  contested: { label: "存疑", className: "bg-brand-blue-soft text-brand-blue" },
  done: { label: "已结论", className: "bg-primary-soft text-primary" },
};

/** 线程卡片类型 */
export const CARD_KIND_META: Record<ThreadCardKind, KindMeta> = {
  question: { label: "研究问题", icon: HelpCircle, tone: "bg-primary-soft text-primary" },
  literature: { label: "文献线索", icon: BookOpen, tone: "bg-brand-blue-soft text-brand-blue" },
  hypothesis: { label: "假设", icon: Lightbulb, tone: "bg-brand-blue-soft text-brand-blue" },
  experiment: { label: "实验设计", icon: FlaskConical, tone: "bg-success-soft text-success" },
  result: { label: "数据结果", icon: LineChart, tone: "bg-success-soft text-success" },
  analysis: { label: "分析笔记", icon: NotebookPen, tone: "bg-chip text-muted" },
  conclusion: { label: "结论", icon: Flag, tone: "bg-ink text-white" },
  next: { label: "下一步", icon: CornerDownRight, tone: "bg-primary-soft text-primary" },
  hint: { label: "AI 提示", icon: TriangleAlert, tone: "bg-primary-soft text-primary" },
};

/** 卡片状态 */
export const CARD_STATUS_META: Record<ThreadCard["status"], { label: string; className: string }> = {
  todo: { label: "未开始", className: "bg-chip text-muted" },
  doing: { label: "进行中", className: "bg-brand-blue-soft text-brand-blue" },
  done: { label: "已完成", className: "bg-success-soft text-success" },
};

/** 资产类型与状态 */
export const ASSET_KIND_META: Record<AssetKind, KindMeta> = {
  paper: { label: "文献", icon: FileText, tone: "bg-primary-soft text-primary" },
  dataset: { label: "数据", icon: Database, tone: "bg-brand-blue-soft text-brand-blue" },
  note: { label: "笔记", icon: StickyNote, tone: "bg-chip text-muted" },
  experiment: { label: "实验", icon: FlaskConical, tone: "bg-success-soft text-success" },
};

export const ASSET_STATUS_META: Record<AssetStatus, { label: string; className: string }> = {
  unread: { label: "未读", className: "bg-chip text-muted" },
  active: { label: "进行中", className: "bg-brand-blue-soft text-brand-blue" },
  analyzed: { label: "已分析", className: "bg-success-soft text-success" },
  archived: { label: "已归档", className: "bg-chip text-faint" },
};

/** 日志来源与类型 */
export const ACTOR_META: Record<ActivityEntry["actor"], { label: string; icon: LucideIcon; tone: string }> = {
  user: { label: "用户", icon: UserRound, tone: "bg-primary-soft text-primary" },
  agent: { label: "Agent", icon: Sparkles, tone: "bg-brand-blue-soft text-brand-blue" },
  system: { label: "系统", icon: Info, tone: "bg-chip text-muted" },
};

export const LOG_TYPE_LABELS: Record<ActivityEntry["type"], string> = {
  note: "笔记",
  literature: "文献",
  data: "数据",
  task: "任务",
  summary: "摘要",
};

/** 运行中状态小图标(Agent 任务) */
export function StateDot({ state }: { state: "queued" | "running" | "done" }) {
  if (state === "done") return <span className="size-2 shrink-0 rounded-full bg-success" />;
  if (state === "running") return <Loader className="size-3.5 shrink-0 animate-spin text-brand-blue" />;
  return <CircleDashed className="size-3.5 shrink-0 text-faint" />;
}
