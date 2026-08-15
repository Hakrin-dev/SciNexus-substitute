"use client";

import * as React from "react";
import {
  Check,
  CheckCircle2,
  Copy,
  Download,
  FileText,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  PROPOSAL_DRAFTS,
  PROPOSAL_TYPES,
  type ProposalType,
} from "@/lib/data/proposal";
import { cn } from "@/lib/utils";

/** 生成步骤(演示:定时依次点亮) */
const GENERATE_STEPS = [
  "检索项目相关的 28 篇文献",
  "提取关键要点与引用关系",
  "组织章节结构",
  "生成初稿",
];

type Phase = "select" | "generating" | "done";

/**
 * 开题报告 / 文献综述生成器(演示)——
 * 项目页头部「AI 生成」按钮触发,弹窗内完成 选类型 → 生成动画 → 初稿 导出
 */
export function ProposalGenerator({ projectName }: { projectName: string }) {
  const [open, setOpen] = React.useState(false);
  const [phase, setPhase] = React.useState<Phase>("select");
  const [type, setType] = React.useState<ProposalType>("proposal");
  const [step, setStep] = React.useState(0);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  /** 生成动画:每 900ms 推进一步,结束后展示初稿 */
  React.useEffect(() => {
    if (phase !== "generating") return;
    if (step >= GENERATE_STEPS.length) {
      const t = setTimeout(() => setPhase("done"), 500);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStep((s) => s + 1), 900);
    return () => clearTimeout(t);
  }, [phase, step]);

  const start = () => {
    setStep(0);
    setPhase("generating");
  };

  const reset = () => {
    setPhase("select");
    setCopied(false);
  };

  const draft = PROPOSAL_DRAFTS[type];

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
    a.download = `${projectName}-${type === "proposal" ? "开题报告" : "文献综述"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Button variant="soft" size="sm" onClick={() => setOpen(true)}>
        <Sparkles className="size-3.5" />
        AI 生成
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="AI 生成开题报告 / 文献综述"
            className={cn(
              "flex max-h-[85vh] w-full flex-col rounded-2xl bg-card p-6 shadow-card",
              phase === "done" ? "max-w-2xl" : "max-w-md",
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
                <Sparkles className="size-4 text-primary" />
                AI 生成 · {projectName}
              </h2>
              <button
                type="button"
                aria-label="关闭"
                className="cursor-pointer rounded-md p-1 text-faint hover:bg-chip hover:text-ink"
                onClick={() => setOpen(false)}
              >
                <X className="size-4" />
              </button>
            </div>

            {/* 阶段一:选择生成类型 */}
            {phase === "select" && (
              <div className="mt-5 space-y-3">
                {PROPOSAL_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    aria-pressed={type === t.value}
                    onClick={() => setType(t.value)}
                    className={cn(
                      "flex w-full cursor-pointer items-start gap-3 rounded-xl border p-4 text-left transition-colors",
                      type === t.value
                        ? "border-primary bg-primary-soft/50"
                        : "border-line hover:border-primary/40",
                    )}
                  >
                    <FileText
                      className={cn(
                        "mt-0.5 size-5 shrink-0",
                        type === t.value ? "text-primary" : "text-faint",
                      )}
                    />
                    <span>
                      <span className="block text-sm font-semibold text-ink">
                        {t.label}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted">
                        {t.description}
                      </span>
                    </span>
                  </button>
                ))}
                <p className="text-xs text-faint">
                  将基于「{projectName}」项目检索到的文献与知识库内容生成初稿
                </p>
                <Button className="w-full" onClick={start}>
                  <Sparkles className="size-4" />
                  开始生成
                </Button>
              </div>
            )}

            {/* 阶段二:生成进度 */}
            {phase === "generating" && (
              <ul className="mt-6 space-y-3.5 pb-2">
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
                        i < step
                          ? "text-ink-2"
                          : i === step
                            ? "font-medium text-ink"
                            : "text-faint",
                      )}
                    >
                      {s}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {/* 阶段三:初稿 */}
            {phase === "done" && (
              <>
                <div className="mt-4 flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={copyDraft}>
                    {copied ? (
                      <Check className="size-3.5 text-success" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                    {copied ? "已复制" : "复制"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={downloadDraft}>
                    <Download className="size-3.5" />
                    下载 Markdown
                  </Button>
                  <Button variant="ghost" size="sm" onClick={reset}>
                    重新选择
                  </Button>
                </div>
                <pre className="scrollbar-subtle mt-4 flex-1 overflow-y-auto whitespace-pre-wrap rounded-xl bg-panel p-5 font-sans text-[13px] leading-relaxed text-ink-2">
                  {draft}
                </pre>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
