"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FolderPlus,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useDemoState } from "@/stores/demo-state";
import { toast } from "@/stores/toast";
import { cn } from "@/lib/utils";

const FIELDS = ["检索", "写作", "分析", "代码", "实验设计", "综述"] as const;

const STEPS = ["基本信息", "团队与技术栈", "确认创建"] as const;

interface Member {
  name: string;
  role: string;
}

export function NewProjectFlow() {
  const router = useRouter();
  const addDemoProject = useDemoState((s) => s.addDemoProject);

  const [step, setStep] = React.useState(0);
  const [name, setName] = React.useState("");
  const [tagline, setTagline] = React.useState("");
  const [field, setField] = React.useState<(typeof FIELDS)[number] | null>(null);
  const [members, setMembers] = React.useState<Member[]>([]);
  const [memberName, setMemberName] = React.useState("");
  const [memberRole, setMemberRole] = React.useState("");
  const [tech, setTech] = React.useState<string[]>([]);
  const [techInput, setTechInput] = React.useState("");

  const canNextStep1 = name.trim().length > 0;

  const addMember = () => {
    if (!memberName.trim()) return;
    setMembers((m) => [...m, { name: memberName.trim(), role: memberRole.trim() || "成员" }]);
    setMemberName("");
    setMemberRole("");
  };
  const removeMember = (i: number) => setMembers((m) => m.filter((_, idx) => idx !== i));

  const addTech = () => {
    const v = techInput.trim();
    if (v && !tech.includes(v)) setTech((t) => [...t, v]);
    setTechInput("");
  };
  const removeTech = (v: string) => setTech((t) => t.filter((x) => x !== v));

  const handleCreate = () => {
    const id = addDemoProject({
      name: name.trim(),
      tagline: tagline.trim() || `${field ?? "科研"}方向的新课题`,
      status: "进行中",
      progress: 0,
      owner: "我",
      overview: tagline.trim() ? [tagline.trim()] : [`${field ?? "科研"}方向的新课题`],
      techStack: tech,
      milestones: [],
      members,
      links: [],
    });
    toast.success(`已创建课题「${name.trim()}」`);
    router.push(`/projects/${id}`);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-[760px] space-y-6 px-8 py-8">
        {/* 头部 */}
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft">
            <FolderPlus className="size-5 text-primary" />
          </span>
          <div>
            <h1 className="text-xl font-bold text-ink">新建课题</h1>
            <p className="mt-0.5 text-xs text-faint">演示流程 · 仅前端原型,不连后端</p>
          </div>
        </div>

        {/* 步骤指示 */}
        <ol className="flex items-center gap-2">
          {STEPS.map((label, i) => (
            <li key={label} className="flex flex-1 items-center gap-2">
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                  i < step
                    ? "bg-primary text-primary-foreground"
                    : i === step
                      ? "bg-primary text-primary-foreground ring-4 ring-primary/15"
                      : "bg-chip text-muted",
                )}
              >
                {i < step ? <Check className="size-4" /> : i + 1}
              </span>
              <span className={cn("text-sm", i === step ? "font-medium text-ink" : "text-muted")}>
                {label}
              </span>
              {i < STEPS.length - 1 && <span className="h-px flex-1 bg-line" />}
            </li>
          ))}
        </ol>

        {/* 步骤内容 */}
        <div className="rounded-2xl bg-card p-6 shadow-card">
          {step === 0 && (
            <div className="space-y-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-ink-2">课题名称 *</span>
                <Input
                  placeholder="如:大语言模型科学推理评测"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-ink-2">一句话简介</span>
                <Input
                  placeholder="这个课题要解决什么问题"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                />
              </label>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-ink-2">研究方向</span>
                <div className="flex flex-wrap gap-1.5">
                  {FIELDS.map((f) => (
                    <button
                      key={f}
                      type="button"
                      aria-pressed={field === f}
                      onClick={() => setField(f)}
                      className={cn(
                        "h-7 cursor-pointer rounded-full px-3 text-xs transition-colors",
                        field === f
                          ? "bg-primary font-medium text-white"
                          : "bg-chip text-muted hover:text-ink-2",
                      )}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              {/* 成员 */}
              <div>
                <p className="mb-2 text-xs font-medium text-ink-2">团队成员</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    placeholder="姓名"
                    value={memberName}
                    onChange={(e) => setMemberName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addMember()}
                    className="w-40"
                  />
                  <Input
                    placeholder="角色(可空)"
                    value={memberRole}
                    onChange={(e) => setMemberRole(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addMember()}
                    className="w-40"
                  />
                  <Button variant="outline" size="sm" onClick={addMember}>
                    <Plus className="size-3.5" />
                    添加
                  </Button>
                </div>
                {members.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {members.map((m, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 rounded-lg border border-line bg-sidebar px-3 py-2 text-sm"
                      >
                        <span className="font-medium text-ink">{m.name}</span>
                        <Badge variant="gray">{m.role}</Badge>
                        <button
                          type="button"
                          aria-label={`移除 ${m.name}`}
                          onClick={() => removeMember(i)}
                          className="ml-auto cursor-pointer rounded-md p-1 text-faint transition-colors hover:bg-chip hover:text-danger"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 技术栈 */}
              <div>
                <p className="mb-2 text-xs font-medium text-ink-2">技术栈 / 工具</p>
                <Input
                  placeholder="输入后回车添加,如 Next.js、PyTorch"
                  value={techInput}
                  onChange={(e) => setTechInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTech())}
                />
                {tech.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {tech.map((t) => (
                      <span
                        key={t}
                        className="flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-1 text-xs text-primary"
                      >
                        {t}
                        <button
                          type="button"
                          aria-label={`移除 ${t}`}
                          onClick={() => removeTech(t)}
                          className="cursor-pointer rounded-full hover:text-danger"
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm font-medium text-ink-2">确认课题信息</p>
              <dl className="divide-y divide-line rounded-xl border border-line">
                <Row label="名称" value={name.trim() || "—"} />
                <Row label="简介" value={tagline.trim() || "—"} />
                <Row label="方向" value={field ?? "—"} />
                <Row label="成员" value={members.length ? members.map((m) => `${m.name}(${m.role})`).join("、") : "暂无"} />
                <Row label="技术栈" value={tech.length ? tech.join("、") : "暂无"} />
              </dl>
              <p className="text-xs text-faint">
                创建后将进入该课题的工作台(演示态数据);真实后端接入后可改为持久化存储。
              </p>
            </div>
          )}
        </div>

        {/* 操作栏 */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => (step === 0 ? router.push("/projects") : setStep((s) => s - 1))}
          >
            <ArrowLeft className="size-4" />
            {step === 0 ? "取消" : "上一步"}
          </Button>

          {step < STEPS.length - 1 ? (
            <Button
              disabled={step === 0 && !canNextStep1}
              onClick={() => setStep((s) => s + 1)}
            >
              下一步
              <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button onClick={handleCreate}>
              <Check className="size-4" />
              创建课题
            </Button>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-4 px-4 py-3">
      <dt className="w-16 shrink-0 text-xs text-faint">{label}</dt>
      <dd className="text-sm text-ink">{value}</dd>
    </div>
  );
}
