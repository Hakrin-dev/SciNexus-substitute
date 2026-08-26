"use client";

import * as React from "react";
import {
  Check,
  Download,
  Github,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Wand2,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  SKILL_CATEGORIES,
  SKILL_MD_TEMPLATE,
  communitySkillsMock,
  skillsMock,
  type CustomSkill,
} from "@/lib/data/tools";
import { useDemoState } from "@/stores/demo-state";
import { toast } from "@/stores/toast";
import { cn } from "@/lib/utils";

/* ── 通用小件 ─────────────────────────────────────────────── */

function Switch({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      className={cn(
        "relative h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors",
        on ? "bg-primary" : "bg-line",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 size-4 rounded-full bg-white shadow transition-all",
          on ? "left-[18px]" : "left-0.5",
        )}
      />
    </button>
  );
}

function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative w-64">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
      <Input placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} className="pl-9" />
    </div>
  );
}

/* ── 内置技能 ─────────────────────────────────────────────── */

function BuiltinTab() {
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState<(typeof SKILL_CATEGORIES)[number]>("全部");
  const skillsOn = useDemoState((s) => s.skillsOn);
  const toggleSkill = useDemoState((s) => s.toggleSkill);
  const isOn = (id: string) => skillsOn[id] ?? true;

  const filtered = skillsMock.filter((s) => {
    if (category !== "全部" && s.category !== category) return false;
    const q = query.trim().toLowerCase();
    return !q || `${s.name} ${s.description}`.toLowerCase().includes(q);
  });
  const enabledCount = skillsMock.filter((s) => isOn(s.id)).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <SearchBox value={query} onChange={setQuery} placeholder="搜索技能…" />
        <div className="flex flex-wrap gap-1.5">
          {SKILL_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
              className={cn(
                "h-7 cursor-pointer rounded-full px-3 text-xs transition-colors",
                category === c ? "bg-primary font-medium text-white" : "bg-chip text-muted hover:text-ink-2",
              )}
            >
              {c}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-faint">
          已启用 {enabledCount}/{skillsMock.length}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((skill, i) => {
          const on = isOn(skill.id);
          return (
            <article
              key={skill.id}
              className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both rounded-xl border border-line bg-card p-4 duration-300"
              style={{ animationDelay: `${Math.min(i * 30, 240)}ms` }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{skill.name}</p>
                  <p className="mt-0.5 text-[11px] text-faint">
                    v{skill.version} · {skill.category}
                  </p>
                </div>
                <Switch on={on} onToggle={() => toggleSkill(skill.id)} label={`启用 ${skill.name}`} />
              </div>
              <p className="mt-2 line-clamp-2 min-h-[2.5rem] text-[13px] leading-relaxed text-muted">
                {skill.description}
              </p>
            </article>
          );
        })}
      </div>
      {filtered.length === 0 && (
        <div className="rounded-2xl bg-card p-10 text-center text-sm text-faint shadow-card">
          没有匹配的技能，换个关键词试试
        </div>
      )}
    </div>
  );
}

/* ── 社区技能 ─────────────────────────────────────────────── */

function CommunityTab() {
  const [query, setQuery] = React.useState("");
  const communityInstalled = useDemoState((s) => s.communityInstalled);
  const toggleCommunityInstall = useDemoState((s) => s.toggleCommunityInstall);
  const customSkills = useDemoState((s) => s.customSkills);

  const published = customSkills.filter((c) => c.published);

  const featured = communitySkillsMock.filter((c) => c.featured);
  const rest = communitySkillsMock.filter((c) => !c.featured);
  const q = query.trim().toLowerCase();
  const matchCommunity = (c: { name: string; description: string; author: string }) =>
    !q || `${c.name} ${c.description} ${c.author}`.toLowerCase().includes(q);

  const featuredList = featured.filter(matchCommunity);
  const restList = rest.filter(matchCommunity);
  const publishedList = published.filter((c) =>
    !q || `${c.name} ${c.description}`.toLowerCase().includes(q),
  );

  const installCard = (
    id: string,
    name: string,
    installed: boolean,
    meta?: React.ReactNode,
    extraBadge?: React.ReactNode,
  ) => (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-ink">{name}</p>
          {extraBadge}
          {meta}
        </div>
        <CommunityDesc id={id} name={name} />
      </div>
      <Button
        variant={installed ? "soft" : "outline"}
        size="sm"
        className="shrink-0 rounded-full px-3"
        onClick={() => {
          toggleCommunityInstall(id);
          toast.success(installed ? `已卸载「${name}」` : `已安装「${name}」`);
        }}
      >
        {installed ? (
          <>
            <Check className="size-3.5" />
            已安装
          </>
        ) : (
          <>
            <Download className="size-3.5" />
            安装
          </>
        )}
      </Button>
    </div>
  );

  return (
    <div className="space-y-5">
      <SearchBox value={query} onChange={setQuery} placeholder="搜索社区技能…" />

      {/* 系统推荐 */}
      {featuredList.length > 0 && (
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 px-1 text-[11px] font-medium tracking-wide text-faint">
            <Sparkles className="size-3.5 text-primary" />
            系统推荐
          </h3>
          <div className="space-y-2">
            {featuredList.map((c, i) => (
              <div
                key={c.id}
                className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both rounded-xl border border-primary/25 bg-primary-soft/40 p-4 duration-300"
                style={{ animationDelay: `${Math.min(i * 30, 240)}ms` }}
              >
                {installCard(
                  c.id,
                  c.name,
                  !!communityInstalled[c.id],
                  <span className="text-[11px] text-faint">
                    {c.author} · {c.installs} 安装
                  </span>,
                  <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                    推荐
                  </span>,
                )}
                <p className="-mt-1 pl-0 text-[13px] leading-relaxed text-muted">{c.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 全部社区技能 */}
      <section>
        <h3 className="mb-2 px-1 text-[11px] font-medium tracking-wide text-faint">全部技能</h3>
        <div className="space-y-2">
          {restList.map((c, i) => (
            <div
              key={c.id}
              className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both rounded-xl border border-line bg-card p-4 duration-300"
              style={{ animationDelay: `${Math.min(i * 30, 240)}ms` }}
            >
              {installCard(
                c.id,
                c.name,
                !!communityInstalled[c.id],
                <span className="text-[11px] text-faint">
                  {c.author} · {c.installs} 安装
                </span>,
              )}
              <p className="mt-1 text-[13px] leading-relaxed text-muted">{c.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 我发布到社区的技能 */}
      {publishedList.length > 0 && (
        <section>
          <h3 className="mb-2 px-1 text-[11px] font-medium tracking-wide text-faint">
            我发布到社区的
          </h3>
          <div className="space-y-2">
            {publishedList.map((c) => (
              <div key={c.id} className="rounded-xl border border-line bg-card p-4">
                {installCard(
                  c.id,
                  c.name,
                  !!communityInstalled[c.id],
                  <span className="text-[11px] text-faint">来自我的自定义</span>,
                  <span className="rounded bg-success-soft px-1.5 py-0.5 text-[10px] font-medium text-success">
                    已发布
                  </span>,
                )}
                <p className="mt-1 text-[13px] leading-relaxed text-muted">{c.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {featuredList.length === 0 && restList.length === 0 && publishedList.length === 0 && (
        <div className="rounded-2xl bg-card p-10 text-center text-sm text-faint shadow-card">
          没有匹配的社区技能
        </div>
      )}
    </div>
  );
}

/** 社区卡描述行(与 mock 对齐) */
function CommunityDesc({ id, name }: { id: string; name: string }) {
  const target = communitySkillsMock.find((c) => c.id === id);
  void name;
  return (
    <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted">
      {target?.description ?? ""}
    </p>
  );
}

/* ── 自定义技能 ───────────────────────────────────────────── */

interface Draft {
  id?: string;
  name: string;
  description: string;
  category: Exclude<(typeof SKILL_CATEGORIES)[number], "全部">;
  contentMd: string;
}

function CustomTab() {
  const customSkills = useDemoState((s) => s.customSkills);
  const addCustomSkill = useDemoState((s) => s.addCustomSkill);
  const updateCustomSkill = useDemoState((s) => s.updateCustomSkill);
  const deleteCustomSkill = useDemoState((s) => s.deleteCustomSkill);
  const toggleCustomPublished = useDemoState((s) => s.toggleCustomPublished);

  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [githubUrl, setGithubUrl] = React.useState("");

  /** 从 GitHub 链接导入:解析仓库名生成 skill.md 草稿 */
  const handleGithubImport = () => {
    const url = githubUrl.trim();
    if (!/^https?:\/\/github\.com\/[\w.-]+\/[\w.-]+/i.test(url)) {
      toast.error("请输入有效的 GitHub 仓库链接");
      return;
    }
    const repo = url.replace(/^https?:\/\/github\.com\//i, "").replace(/\.git$/i, "");
    const name = repo.split("/")[1] ?? repo;
    addCustomSkill({
      name,
      description: `从 GitHub 导入:${repo}`,
      category: "代码",
      version: "1.0.0",
      contentMd: SKILL_MD_TEMPLATE(name, `从 GitHub 导入:${repo}`, "代码"),
      fromGithub: url,
    });
    setGithubUrl("");
    toast.success(`已导入「${name}」,可在列表中编辑 skill.md`);
  };

  const handleSave = () => {
    if (!draft) return;
    if (!draft.name.trim()) {
      toast.error("请填写技能名称");
      return;
    }
    if (draft.id) {
      updateCustomSkill(draft.id, {
        name: draft.name.trim(),
        description: draft.description.trim(),
        category: draft.category,
        contentMd: draft.contentMd,
      });
      toast.success("技能已更新");
    } else {
      addCustomSkill({
        name: draft.name.trim(),
        description: draft.description.trim(),
        category: draft.category,
        version: "1.0.0",
        contentMd: draft.contentMd || SKILL_MD_TEMPLATE(draft.name, draft.description, draft.category),
      });
      toast.success("技能已创建并应用");
    }
    setDraft(null);
  };

  /* 编辑器 */
  if (draft) {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-2 space-y-4 rounded-2xl bg-card p-6 shadow-card duration-300">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-[15px] font-semibold text-ink">
            <Wand2 className="size-4 text-primary" />
            {draft.id ? "编辑自定义技能" : "新建自定义技能"}
          </h2>
          <button
            type="button"
            aria-label="关闭"
            onClick={() => setDraft(null)}
            className="cursor-pointer rounded-md p-1 text-faint hover:bg-chip hover:text-ink"
          >
            <XIcon />
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-ink-2">技能名称</span>
            <Input
              placeholder="如:实验记录整理"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-ink-2">一句话描述</span>
            <Input
              placeholder="这个技能做什么、什么时候触发"
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </label>
        </div>
        <div>
          <span className="text-xs font-medium text-ink-2">分类</span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {SKILL_CATEGORIES.filter((c) => c !== "全部").map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={draft.category === c}
                onClick={() => setDraft({ ...draft, category: c })}
                className={cn(
                  "h-7 cursor-pointer rounded-full px-3 text-xs transition-colors",
                  draft.category === c
                    ? "bg-primary font-medium text-white"
                    : "bg-chip text-muted hover:text-ink-2",
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-medium text-ink-2">skill.md</span>
            <button
              type="button"
              onClick={() =>
                setDraft({
                  ...draft,
                  contentMd: SKILL_MD_TEMPLATE(draft.name, draft.description, draft.category),
                })
              }
              className="text-[11px] text-primary hover:underline"
            >
              插入模板
            </button>
          </div>
          <textarea
            value={draft.contentMd}
            onChange={(e) => setDraft({ ...draft, contentMd: e.target.value })}
            rows={12}
            className="w-full resize-y rounded-xl border border-line bg-sidebar px-4 py-3 font-mono text-[12px] leading-relaxed text-ink outline-none transition-colors placeholder:text-faint focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/15"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDraft(null)}>
            取消
          </Button>
          <Button onClick={handleSave}>保存并应用</Button>
        </div>
      </div>
    );
  }

  /* 列表 */
  return (
    <div className="space-y-4">
      {/* GitHub 导入 */}
      <section className="rounded-xl border border-line bg-card p-4">
        <p className="flex items-center gap-1.5 text-xs font-medium text-ink-2">
          <Github className="size-3.5" />
          从 GitHub 导入技能
        </p>
        <div className="mt-2.5 flex gap-2">
          <Input
            placeholder="https://github.com/owner/skill-repo"
            value={githubUrl}
            onChange={(e) => setGithubUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleGithubImport()}
            className="font-mono text-[13px]"
          />
          <Button variant="outline" size="sm" className="shrink-0" onClick={handleGithubImport}>
            导入
          </Button>
        </div>
      </section>

      <div className="flex items-center justify-between">
        <p className="text-xs text-faint">
          共 {customSkills.length} 个 · 创建后自动应用到对话,可发布到社区
        </p>
        <Button
          size="sm"
          className="rounded-xl"
          onClick={() =>
            setDraft({
              name: "",
              description: "",
              category: "检索",
              contentMd: SKILL_MD_TEMPLATE("", "", "检索"),
            })
          }
        >
          <Plus className="size-3.5" />
          新建技能
        </Button>
      </div>

      {customSkills.length > 0 ? (
        <div className="space-y-3">
          {customSkills.map((skill: CustomSkill, i) => (
            <article
              key={skill.id}
              className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both rounded-xl border border-line bg-card p-4 duration-300"
              style={{ animationDelay: `${Math.min(i * 30, 240)}ms` }}
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <p className="text-sm font-semibold text-ink">{skill.name}</p>
                {skill.published && (
                  <span className="rounded bg-success-soft px-1.5 py-0.5 text-[10px] font-medium text-success">
                    已发布到社区
                  </span>
                )}
                {skill.fromGithub && (
                  <span className="flex items-center gap-1 rounded bg-chip px-1.5 py-0.5 text-[10px] text-muted">
                    <Github className="size-3" />
                    导入
                  </span>
                )}
                <span className="text-[11px] text-faint">
                  v{skill.version} · {skill.category}
                </span>
              </div>
              <p className="mt-1 text-[13px] text-muted">{skill.description}</p>

              {/* skill.md 预览(折叠) */}
              <details className="group mt-2">
                <summary className="cursor-pointer text-[11px] text-primary hover:underline">
                  查看 skill.md
                </summary>
                <pre className="mt-2 overflow-x-auto rounded-lg bg-sidebar p-3 font-mono text-[11px] leading-relaxed text-ink-2">
                  {skill.contentMd}
                </pre>
              </details>

              <div className="mt-3 flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 rounded-full px-3 text-xs"
                  onClick={() =>
                    setDraft({
                      id: skill.id,
                      name: skill.name,
                      description: skill.description,
                      category: skill.category,
                      contentMd: skill.contentMd,
                    })
                  }
                >
                  <Pencil className="size-3" />
                  编辑
                </Button>
                <Button
                  variant={skill.published ? "soft" : "outline"}
                  size="sm"
                  className="h-7 rounded-full px-3 text-xs"
                  onClick={() => {
                    toggleCustomPublished(skill.id);
                    toast.success(
                      skill.published ? `已从社区下架「${skill.name}」` : `「${skill.name}」已发布到社区`,
                    );
                  }}
                >
                  <Zap className="size-3" />
                  {skill.published ? "从社区下架" : "发布到社区"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 rounded-full px-3 text-xs"
                  onClick={() => toast.success(`「${skill.name}」已应用到当前对话`)}
                >
                  <Check className="size-3" />
                  应用到对话
                </Button>
                <button
                  type="button"
                  aria-label={`删除 ${skill.name}`}
                  onClick={() => {
                    deleteCustomSkill(skill.id);
                    toast.info(`已删除「${skill.name}」`);
                  }}
                  className="ml-auto cursor-pointer rounded-md p-1.5 text-faint transition-colors hover:bg-chip hover:text-danger"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl bg-card p-12 text-center shadow-card">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-chip">
            <Wand2 className="size-5 text-faint" />
          </span>
          <p className="mt-3 text-sm text-muted">还没有自定义技能</p>
          <p className="mt-1 text-xs text-faint">
            用 skill.md 定义触发时机与执行步骤,或从 GitHub 导入现成仓库
          </p>
        </div>
      )}
    </div>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

/* ── 主组件 ─────────────────────────────────────────────── */

/** 技能库 —— 内置 / 社区(推荐+搜索) / 自定义(skill.md + GitHub 导入) */
export function SkillsBoard() {
  return (
    <Tabs defaultValue="builtin">
      <TabsList className="gap-4 border-b border-line">
        <TabsTrigger value="builtin" className="flex items-center gap-1.5">
          <Zap className="size-4" strokeWidth={1.8} />
          内置
        </TabsTrigger>
        <TabsTrigger value="community" className="flex items-center gap-1.5">
          <Sparkles className="size-4" strokeWidth={1.8} />
          社区
        </TabsTrigger>
        <TabsTrigger value="custom" className="flex items-center gap-1.5">
          <Wand2 className="size-4" strokeWidth={1.8} />
          自定义
        </TabsTrigger>
      </TabsList>
      <TabsContent value="builtin" className="mt-5">
        <BuiltinTab />
      </TabsContent>
      <TabsContent value="community" className="mt-5">
        <CommunityTab />
      </TabsContent>
      <TabsContent value="custom" className="mt-5">
        <CustomTab />
      </TabsContent>
    </Tabs>
  );
}
