"use client";

import * as React from "react";
import {
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle2,
  Copy,
  Download,
  FileText,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiPost } from "@/lib/api/client";
import {
  PROPOSAL_DRAFTS,
  PROPOSAL_LABELS,
  PROPOSAL_TYPES,
  type ProposalType,
} from "@/lib/data/proposal";
import { cn } from "@/lib/utils";

const TYPE_ICONS = { proposal: FileText, review: BookOpen } as const;

/** 生成步骤(演示:定时依次点亮) */
const GENERATE_STEPS = [
  "检索项目相关的 28 篇文献",
  "提取关键要点与引用关系",
  "组织章节结构",
  "生成初稿",
];

type Phase = "select" | "generating" | "done";

/**
 * AI 生成工作台(中间栏内联编辑)——
 * 由右侧助手栏「AI 生成」按钮进入:选类型 → 生成进度 → 初稿在中间栏直接编辑,不再弹窗。
 */
export function ProposalStudio({
  projectName,
  onExit,
}: {
  projectName: string;
  onExit: () => void;
}) {
  const [phase, setPhase] = React.useState<Phase>("select");
  const [type, setType] = React.useState<ProposalType>("proposal");
  const [step, setStep] = React.useState(0);
  const [copied, setCopied] = React.useState(false);
  const [draft, setDraft] = React.useState("");

  React.useEffect(() => {
    if (phase !== "generating") return;
    if (step >= GENERATE_STEPS.length) {
      const t = setTimeout(() => setPhase("done"), 500);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStep((s) => s + 1), 900);
    return () => clearTimeout(t);
  }, [phase, step]);

  const start = async () => {
    setStep(0);
    setPhase("generating");
    try {
      const json = await apiPost<{ content?: string }>("/api/proposal/generate", {
        type,
        topic: projectName,
      });
      setDraft(json.data?.content ?? PROPOSAL_DRAFTS[type]);
    } catch {
      setDraft(PROPOSAL_DRAFTS[type]);
    }
  };

  const reset = () => {
    setPhase("select");
    setCopied(false);
    setDraft("");
  };

  const copyDraft = async () => {
    try {
      await navigator.clipboard.writeText(draft);
    } catch {
      // 剪贴板不可用时静默失败,仍展示已复制态做演示
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const downloadDraft = () => {
    const blob = new Blob([draft], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectName}-${PROPOSAL_LABELS[type]}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const charCount = draft.replace(/\s/g, "").length;

  return (
    <section className="rounded-2xl bg-card shadow-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line/70 px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <Sparkles className="size-5" strokeWidth={1.8} />
          </span>
          <div>
            <h2 className="text-[15px] font-bold text-ink">AI 生成 · {projectName}</h2>
            <p className="mt-0.5 text-xs text-muted">
              基于项目文献与知识库生成初稿,在下方编辑器直接修改
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onExit}>
          <ArrowLeft className="size-3.5" />
          返回工作台
        </Button>
      </header>

      <div className="p-6">
        {phase === "select" && (
          <StudioSelect type={type} onPick={setType} onStart={start} projectName={projectName} />
        )}

        {phase === "generating" && (
          <ul className="space-y-3.5 py-6">
            {GENERATE_STEPS.map((s, i) => (
              <li key={s} className="flex items-center gap-3 text-sm">
                {i < step ? (
                  <CheckCircle2 className="size-4.5 shrink-0 text-success" />
                ) : i === step ? (
                  <Loader2 className="size-4.5 shrink-0 animate-spin text-primary" />
                ) : (
                  <span className="size-4.5 shrink-0 rounded-full border border-line" />
                )}
                <span
                  className={cn(
                    i < step ? "text-ink-2" : i === step ? "font-medium text-ink" : "text-faint",
                  )}
                >
                  {s}
                </span>
              </li>
            ))}
          </ul>
        )}

        {phase === "done" && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-primary-soft px-3 py-1.5 text-xs font-medium text-primary">
                {PROPOSAL_LABELS[type]} · 初稿
              </span>
              <Button variant="outline" size="sm" onClick={copyDraft}>
                {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
                {copied ? "已复制" : "复制"}
              </Button>
              <Button variant="outline" size="sm" onClick={downloadDraft}>
                <Download className="size-3.5" />
                下载 Markdown
              </Button>
              <Button variant="ghost" size="sm" onClick={reset}>
                重新生成
              </Button>
              <span className="ml-auto text-[11px] text-faint">{charCount} 字 · 可直接编辑</span>
            </div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              spellCheck={false}
              aria-label="初稿编辑器"
              className="scrollbar-subtle mt-3 h-[560px] w-full resize-y rounded-xl border border-line bg-panel p-5 font-sans text-[13px] leading-relaxed text-ink-2 outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/15"
            />
          </>
        )}
      </div>
    </section>
  );
}

/** 阶段一:选择生成类型(开题报告 / 文献综述 / 组会PPT) */
function StudioSelect({
  type,
  onPick,
  onStart,
  projectName,
}: {
  type: ProposalType;
  onPick: (t: ProposalType) => void;
  onStart: () => void;
  projectName: string;
}) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        {PROPOSAL_TYPES.map((t) => {
          const Icon = TYPE_ICONS[t.value];
          const active = type === t.value;
          return (
            <button
              key={t.value}
              type="button"
              aria-pressed={active}
              onClick={() => onPick(t.value)}
              className={cn(
                "cursor-pointer rounded-xl border p-4 text-left transition-all",
                active
                  ? "border-primary bg-primary-soft/50 shadow-card"
                  : "border-line hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-pop",
              )}
            >
              <span
                className={cn(
                  "flex size-9 items-center justify-center rounded-lg",
                  active ? "bg-primary-soft text-primary" : "bg-chip text-muted",
                )}
              >
                <Icon className="size-4.5" strokeWidth={1.8} />
              </span>
              <span className="mt-3 block text-sm font-semibold text-ink">{t.label}</span>
              <span className="mt-1 block text-xs leading-relaxed text-muted">{t.description}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-faint">
          将基于「{projectName}」项目检索到的 28 篇文献与知识库内容生成{PROPOSAL_LABELS[type]}初稿
        </p>
        <Button onClick={onStart}>
          <Sparkles className="size-4" />
          开始生成
        </Button>
      </div>
    </>
  );
}
