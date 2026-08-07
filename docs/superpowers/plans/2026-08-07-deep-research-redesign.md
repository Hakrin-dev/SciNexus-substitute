# Deep Research 重设计 + 旧页迁移深度搜索 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `/agents/deep-research` 旧页迁移为 `/agents/deep-search`(发现页「深度搜索」跳转目标),并在原路由实现全新的研究报告型双栏工作台页面。

**Architecture:** 单路由两视图(入口态 home / Session 工作台 session),全部由 `lib/data/deep-research.ts` 静态 mock + 确定性预录事件流驱动(100ms tick 播放器 hook,无随机、无后端)。视图切换在 client 页组件内用状态机完成,URL 参数(`?q=` / `?autostart=1` / `?mode=instant`)在客户端 effect 解析(沿用 research-board 惯例,规避 useSearchParams 的 Suspense 约束)。

**Tech Stack:** Next.js 16 App Router + React 19 + TS + Tailwind 4(手写 shadcn 风格组件;设计令牌:bg-card / text-ink / text-ink-2 / text-muted / text-faint / bg-chip / bg-panel / border-line / bg-primary / bg-primary-soft / text-primary / bg-success / bg-success-soft / text-success / shadow-card / shadow-pop / bg-brand-gold)。

**规格文档:** `docs/superpowers/specs/2026-08-07-deep-research-redesign-design.md`

**关于测试:** 项目无单测框架(既定取舍,Vitest 未接入)。验证方式 = `pnpm build`(编译+类型检查)+ headless Edge 截图目检。每个任务的步骤按「实现 → 构建验证 → 提交」组织。

---

### Task 1: 旧页迁移 `/agents/deep-research` → `/agents/deep-search`

**Files:**
- Move: `app/agents/deep-research/` → `app/agents/deep-search/`
- Modify: `app/agents/deep-search/page.tsx`(页头注释)
- Modify: `components/features/search/search-hero.tsx:30-33`

- [ ] **Step 1: git mv 目录**

```bash
cd /home/hkr/projects/shenzhi
git mv app/agents/deep-research app/agents/deep-search
```

- [ ] **Step 2: 更新迁移后页面的头注释**

`app/agents/deep-search/page.tsx` 第 11-14 行注释改为:

```tsx
/**
 * 深度搜索结果页 `/agents/deep-search` —— 对应「深知-AI研究助手.svg」,
 * 发现页「深度搜索」按钮的跳转目标(由 /agents/deep-research 迁移而来)
 */
```

- [ ] **Step 3: 发现页按钮改跳新路由**

`components/features/search/search-hero.tsx` 的 onSubmit(第 30-33 行)改为:

```tsx
  const onSubmit = handleSubmit(({ query }) => {
    // 深度搜索 → 深度搜索结果页(由旧 Deep Research 页迁移而来)
    router.push(`/agents/deep-search?q=${encodeURIComponent(query)}`);
  });
```

- [ ] **Step 4: 确认无其他 stale 引用**

Run: `grep -rn "agents/deep-research" app components lib`
Expected: 仅剩 `components/layout/app-sidebar.tsx` 一处(侧边栏 Deep Research 入口,指向即将由新设计接管的路由,Task 9 创建该页面;在此期间该链接 404,属预期中间态)

- [ ] **Step 5: 构建验证**

Run: `pnpm build`
Expected: 编译通过,route 表中出现 `/agents/deep-search`,不再出现 `/agents/deep-research`

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: 旧 Deep Research 页迁移为 /agents/deep-search(深度搜索跳转目标)"
```

---

### Task 2: 类型定义 + mock 数据

**Files:**
- Modify: `types/index.ts`(文件末尾追加)
- Create: `lib/data/deep-research.ts`

- [ ] **Step 1: types/index.ts 末尾追加 Deep Research 类型**

```ts
/** Deep Research 研究计划节 */
export interface DRPlanSection {
  id: string;
  /** 大纲节标题,如 "1. 代表性方法与技术脉络" */
  title: string;
  /** 该节检索意图(计划卡内展示) */
  query: string;
}

/** Deep Research 来源 / 参考文献条目 */
export interface DRSource {
  /** 引用编号 [n] */
  id: number;
  /** 来源墙 chip 用短名,如 "Diffusion Policy" */
  short: string;
  title: string;
  /** 如 "CoRL 2024 · Stanford" */
  venue: string;
  author: string;
  /** 如 "引用 1.8k" */
  citations: string;
  recommended?: boolean;
}

/** Deep Research 报告节 */
export interface DRReportSection {
  /** 与 DRPlanSection.id 对应 */
  id: string;
  heading: string;
  /** 段落,含 [n] 引用标记 */
  paragraphs: string[];
  table?: {
    caption: string;
    header: string[];
    rows: string[][];
    highlightRow?: number;
  };
  /** 编号列表(趋势等) */
  list?: string[];
}

/** Deep Research 报告 */
export interface DRReport {
  question: string;
  title: string;
  abstract: string;
  stats: { read: number; cited: number };
  sections: DRReportSection[];
  references: DRSource[];
}

export type DRStepKind = "search" | "read" | "analyze" | "write";

/** Deep Research 预录步骤事件(确定性时间轴) */
export interface DRStepEvent {
  offsetMs: number;
  kind: DRStepKind;
  label: string;
  /** write 类事件关联的章节 */
  sectionId?: string;
}

/** Deep Research 历史研究条目 */
export interface DRHistoryItem {
  id: string;
  title: string;
  status: "已完成" | "进行中";
  sources: number;
  time: string;
}
```

- [ ] **Step 2: 创建 `lib/data/deep-research.ts`(完整内容)**

```ts
/**
 * Deep Research mock 数据 —— 确定性、无随机(跟随 auto-research 惯例)
 * 内容主题沿用扩散模型语境,与 /agents/deep-search 页演示数据一致
 */
import type {
  DRHistoryItem,
  DRPlanSection,
  DRReport,
  DRStepEvent,
} from "@/types";

/** 研究计划:4 节大纲,节状态由事件流派生 */
export const drPlan: DRPlanSection[] = [
  { id: "s1", title: "1. 代表性方法与技术脉络", query: "diffusion policy robot manipulation 代表工作" },
  { id: "s2", title: "2. 性能对比与评测基准", query: "diffusion policy benchmark 成功率 对比" },
  { id: "s3", title: "3. 工业部署现状与瓶颈", query: "diffusion policy 工业部署 延迟 算力" },
  { id: "s4", title: "4. 趋势展望与研究方向", query: "VLA 基础模型 扩散策略 融合趋势" },
];

/** 报告全文(摘要 + 4 节 + 15 条参考文献) */
export const drReport: DRReport = {
  question:
    "扩散模型在机器人策略学习中最近 6 个月有哪些突破性进展?请对比主流方法,并分析对实际工业部署的影响。",
  title: "扩散模型在机器人策略学习中的最新进展",
  abstract:
    "本报告调研了 28 篇文献:梳理从 Diffusion Policy 到 RDT-1B 的技术脉络,对比主流方法在公开基准上的性能,分析工业部署的实时性与算力瓶颈,并给出 VLA 融合等下一步研究方向。",
  stats: { read: 28, cited: 15 },
  sections: [
    {
      id: "s1",
      heading: "1. 代表性方法与技术脉络",
      paragraphs: [
        "过去 6 个月,扩散策略 (Diffusion Policy) [1] 在机器人操控领域已经从学术原型走向工业验证。核心进展可以归纳为三条主线:动作分块 (Action Chunking) 与时序一致性优化、跨本体数据融合,以及面向真实硬件的延迟压缩。",
        "Chi 等人的 Diffusion Policy [1] 首次将 DDPM 引入动作空间预测,奠定了 chunk-based 扩散策略的范式;动作分块的思想可追溯至 ACT [14] 的时序集成;之后的 3D Diffusion Policy (DP3) [2] 通过稀疏体素特征将推理扩展到 6 自由度操作;最近的 RDT-1B [3] 与 NVIDIA 的 DexMamba [4] 则把模型规模推到十亿参数,并在跨本体迁移上取得显著增益。",
      ],
    },
    {
      id: "s2",
      heading: "2. 性能对比与评测基准",
      paragraphs: [
        "在 5 个公开基准(含 DROID [10] 真实场景子集)上,主流扩散策略的平均成功率与推理开销如下。可以看到,参数量的增长带来了显著的成功率收益,但推理延迟同步上升,这是工业部署的核心矛盾。",
      ],
      table: {
        caption: "性能对比(在 5 个公开基准上)",
        header: ["方法", "平均成功率", "参数量", "推理延迟"],
        rows: [
          ["Diffusion Policy [1]", "62.4%", "73M", "48ms / chunk"],
          ["DP3 [2]", "71.8%", "180M", "62ms / chunk"],
          ["RDT-1B [3]", "84.6%", "1.2B", "94ms / chunk"],
        ],
        highlightRow: 2,
      },
    },
    {
      id: "s3",
      heading: "3. 工业部署现状与瓶颈",
      paragraphs: [
        "工业部署方面,BMW 与 Figure 的产线实测 [5] 表明:扩散策略在多 SKU 装配任务上比传统 Behavior Cloning 高 28% 成功率,但对硬件算力要求较高(≥ RTX 4090 级别 GPU 才能满足 60Hz 控制频率 [6])。",
        "实时性方面,RTC [6] 通过异步动作分块与推理流水线将端到端延迟压到 20ms 以内;UMI [15] 则提供了低成本的跨本体数据采集路径,缓解了真机数据瓶颈。",
      ],
    },
    {
      id: "s4",
      heading: "4. 趋势展望与研究方向",
      paragraphs: ["综合 28 篇文献,三条趋势值得关注:"],
      list: [
        "模型规模从百 M 走向十亿级,与大语言模型的融合成为新方向 (PaLM-E [7]、RT-2 [12])。",
        "动作分块从 8 步扩展到 64 步,时序一致性约束 (TCP [8]) 显著降低了抖动。",
        "与 VLA 模型 (Vision-Language-Action) 深度结合,出现通用机器人基础模型 (Octo [9]、OpenVLA [11])。",
      ],
    },
  ],
  references: [
    { id: 1, short: "Diffusion Policy", title: "Diffusion Policy: Visuomotor Policy Learning via Action Diffusion", venue: "CoRL 2024 · Stanford", author: "Chi et al.", citations: "引用 1.8k" },
    { id: 2, short: "DP3", title: "3D Diffusion Policy: Generalizable Visuomotor Policy Learning via Sparse 3D Representation", venue: "RSS 2025 · MIT", author: "Ze et al.", citations: "引用 642" },
    { id: 3, short: "RDT-1B", title: "RDT-1B: A Diffusion Foundation Model for Robotic Manipulation", venue: "ICML 2026 · 推荐", author: "Liu et al.", citations: "引用 312", recommended: true },
    { id: 4, short: "DexMamba", title: "DexMamba: 面向灵巧手控制的视觉状态空间扩散模型", venue: "arXiv 2026 · NVIDIA", author: "Wen et al.", citations: "引用 89" },
    { id: 5, short: "产线实测", title: "Diffusion Policies on the Factory Floor: A Multi-SKU Assembly Field Study", venue: "Case Study 2026 · BMW / Figure", author: "Huber et al.", citations: "引用 45" },
    { id: 6, short: "RTC", title: "Real-Time Chunking: 面向 60Hz 控制的扩散推理压缩", venue: "arXiv 2026 · ETH Zurich", author: "Schmid et al.", citations: "引用 27" },
    { id: 7, short: "PaLM-E", title: "PaLM-E: An Embodied Multimodal Language Model", venue: "ICML 2023 · Google", author: "Driess et al.", citations: "引用 2.4k" },
    { id: 8, short: "TCP", title: "Temporally Consistent Policy Chunks for Manipulation", venue: "NeurIPS 2025 · THU", author: "Zhao et al.", citations: "引用 156" },
    { id: 9, short: "Octo", title: "Octo: An Open-Source Generalist Robot Policy", venue: "RSS 2024 · UC Berkeley", author: "Octo Model Team", citations: "引用 980" },
    { id: 10, short: "DROID", title: "DROID: A Large-Scale In-the-Wild Robot Manipulation Dataset", venue: "RA-L 2024 · Stanford", author: "Khazatsky et al.", citations: "引用 720" },
    { id: 11, short: "OpenVLA", title: "OpenVLA: An Open-Source Vision-Language-Action Model", venue: "CoRL 2024 · Stanford", author: "Kim et al.", citations: "引用 540" },
    { id: 12, short: "RT-2", title: "RT-2: Vision-Language-Action Models Transfer Web Knowledge", venue: "CoRL 2023 · Google DeepMind", author: "Brohan et al.", citations: "引用 1.5k" },
    { id: 13, short: "π0", title: "π0: A Vision-Language-Action Flow Model for General Robot Control", venue: "arXiv 2024 · Physical Intelligence", author: "Black et al.", citations: "引用 410" },
    { id: 14, short: "ACT", title: "Learning Fine-Grained Bimanual Manipulation with Low-Cost Hardware", venue: "RSS 2023 · Stanford", author: "Zhao et al.", citations: "引用 1.1k" },
    { id: 15, short: "UMI", title: "Universal Manipulation Interface: In-the-Wild Robot Teaching", venue: "RSS 2024 · Stanford", author: "Chi et al.", citations: "引用 380" },
  ],
};

/**
 * 预录步骤事件流 —— 总时长约 12s
 * (plan_ready 由初始态表达,done 由播完推导,均不占事件)
 */
export const drEvents: DRStepEvent[] = [
  { offsetMs: 900, kind: "search", label: "检索「diffusion policy robot manipulation」· 命中 32 个来源" },
  { offsetMs: 2500, kind: "search", label: "扩展检索「VLA / 世界模型 技术路线」· 补入 14 个来源" },
  { offsetMs: 4200, kind: "read", label: "去重、按引用量与时效加权,精读 28 篇" },
  { offsetMs: 5600, kind: "analyze", label: "按方法谱系聚类,归纳 3 条技术主线" },
  { offsetMs: 6800, kind: "write", sectionId: "s1", label: "撰写第 1 节 · 代表性方法与技术脉络" },
  { offsetMs: 8000, kind: "write", sectionId: "s2", label: "撰写第 2 节 · 性能对比与评测基准" },
  { offsetMs: 9200, kind: "write", sectionId: "s3", label: "撰写第 3 节 · 工业部署现状与瓶颈" },
  { offsetMs: 10400, kind: "write", sectionId: "s4", label: "撰写第 4 节 · 趋势展望与研究方向" },
  { offsetMs: 11300, kind: "analyze", label: "交叉核对引用,生成参考文献列表(15 篇)" },
];

/** 运行总时长(末尾事件 + 缓冲) */
export const DR_RUN_TOTAL_MS = 12000;

/** 入口态:历史研究(全部加载同一份示例报告) */
export const drHistory: DRHistoryItem[] = [
  { id: "dr1", title: "扩散模型在机器人策略学习中的进展", status: "已完成", sources: 28, time: "昨天" },
  { id: "dr2", title: "具身智能中的世界模型综述", status: "进行中", sources: 17, time: "2 天前" },
  { id: "dr3", title: "Mamba 与状态空间模型在控制中的应用", status: "已完成", sources: 31, time: "上周" },
  { id: "dr4", title: "稀疏注意力机制系统对比", status: "已完成", sources: 9, time: "2 周前" },
];

/** 入口态:建议主题(点击填入输入框) */
export const drSuggestions = [
  "扩散策略在工业部署中的现状与瓶颈",
  "世界模型与 VLA 技术路线有什么差异?",
  "具身智能评测基准的最新综述",
];

/** 入口态:研究范围选项(单选,纯展示) */
export const drScopeOptions = ["全网文献", "我的知识库", "近 12 个月"];
```

- [ ] **Step 3: 构建验证**

Run: `pnpm build`
Expected: 编译通过(新文件暂无引用方,无 unused 报错——ESLint 只查本文件内未用变量)

- [ ] **Step 4: Commit**

```bash
git add types/index.ts lib/data/deep-research.ts
git commit -m "feat: Deep Research 类型定义与 mock 数据(计划/报告/事件流/历史)"
```

---

### Task 3: 抽取 `withCitations` 到 `lib/citations.tsx`

**Files:**
- Create: `lib/citations.tsx`
- Modify: `components/features/agent/answer-card.tsx:1-17`

- [ ] **Step 1: 创建 `lib/citations.tsx`**

```tsx
import type { ReactNode } from "react";

/** 将正文中的 [n] 引用标记渲染为主色上标样式 */
export function withCitations(text: string): ReactNode[] {
  return text.split(/(\[\d+\])/g).map((part, i) =>
    /^\[\d+\]$/.test(part) ? (
      <sup key={i} className="mx-0.5 font-medium text-primary">
        {part}
      </sup>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}
```

- [ ] **Step 2: answer-card.tsx 改为引用共享实现**

`components/features/agent/answer-card.tsx` 头部(第 1-17 行)由:

```tsx
import { Sparkles } from "lucide-react";
import { answerBlocks, agentSession } from "@/lib/data/agent";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/** 将正文中的 [n] 引用标记渲染为主色上标样式 */
function withCitations(text: string): ReactNode[] {
  return text.split(/(\[\d+\])/g).map((part, i) =>
    /^\[\d+\]$/.test(part) ? (
      <sup key={i} className="mx-0.5 font-medium text-primary">
        {part}
      </sup>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}
```

改为:

```tsx
import { Sparkles } from "lucide-react";
import { answerBlocks, agentSession } from "@/lib/data/agent";
import { withCitations } from "@/lib/citations";
import { cn } from "@/lib/utils";
```

文件其余部分不变。

- [ ] **Step 3: 构建验证**

Run: `pnpm build`
Expected: 编译通过(answer-card 行为零变化)

- [ ] **Step 4: Commit**

```bash
git add lib/citations.tsx components/features/agent/answer-card.tsx
git commit -m "refactor: withCitations 引用上标渲染抽取至 lib/citations 共享"
```

---

### Task 4: 运行状态机 hook `use-deep-research-run.ts`

**Files:**
- Create: `components/features/deep-research/use-deep-research-run.ts`

- [ ] **Step 1: 创建 hook(完整内容)**

```ts
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DR_RUN_TOTAL_MS,
  drEvents,
  drPlan,
  drReport,
} from "@/lib/data/deep-research";
import type { DRStepEvent } from "@/types";

/** 计划节/报告节三态:待生成 → 生成中 → 已生成 */
export type DRSectionState = "todo" | "running" | "done";

export interface DeepResearchRun {
  phase: "running" | "done";
  elapsedMs: number;
  /** 已出现的步骤事件 */
  visibleEvents: DRStepEvent[];
  /** 各节状态(计划卡与报告节共用) */
  sectionState: Record<string, DRSectionState>;
  /** 来源墙可见条数 */
  visibleSources: number;
}

/**
 * 节状态派生:某节 write 事件出现 → 生成中;
 * 更靠后的节已开始、或运行结束 → 已生成;否则待生成。
 */
function deriveSectionState(visible: DRStepEvent[], done: boolean) {
  const started = new Set(
    visible.filter((e) => e.kind === "write").map((e) => e.sectionId),
  );
  const state: Record<string, DRSectionState> = {};
  drPlan.forEach((sec, i) => {
    if (!started.has(sec.id)) {
      state[sec.id] = "todo";
      return;
    }
    const laterStarted = drPlan.slice(i + 1).some((l) => started.has(l.id));
    state[sec.id] = laterStarted || done ? "done" : "running";
  });
  return state;
}

/**
 * Deep Research 运行播放器 —— 确定性预录事件流(无随机)
 * instant=true 直接落在完成态(历史记录 / headless 截图用),
 * 否则以 100ms tick 推进;组件卸载自动清理 interval。
 * 配合 key 重挂载实现「返回后再次开始 → 从头播放」。
 */
export function useDeepResearchRun(instant: boolean): DeepResearchRun {
  const [elapsedMs, setElapsedMs] = useState(() =>
    instant ? DR_RUN_TOTAL_MS : 0,
  );

  useEffect(() => {
    if (instant) return;
    const t0 = performance.now();
    const iv = window.setInterval(() => {
      setElapsedMs(Math.min(performance.now() - t0, DR_RUN_TOTAL_MS));
    }, 100);
    return () => window.clearInterval(iv);
  }, [instant]);

  const done = elapsedMs >= DR_RUN_TOTAL_MS;
  const visibleEvents = useMemo(
    () => drEvents.filter((e) => e.offsetMs <= elapsedMs),
    [elapsedMs],
  );
  const sectionState = useMemo(
    () => deriveSectionState(visibleEvents, done),
    [visibleEvents, done],
  );
  /** 来源墙:read 事件后全量;此前任一 search 事件后先出 8 条 */
  const visibleSources = useMemo(() => {
    if (visibleEvents.some((e) => e.kind === "read")) {
      return drReport.references.length;
    }
    return visibleEvents.some((e) => e.kind === "search") ? 8 : 0;
  }, [visibleEvents]);

  return {
    phase: done ? "done" : "running",
    elapsedMs,
    visibleEvents,
    sectionState,
    visibleSources,
  };
}
```

- [ ] **Step 2: 构建验证**

Run: `pnpm build`
Expected: 编译通过

- [ ] **Step 3: Commit**

```bash
git add components/features/deep-research/use-deep-research-run.ts
git commit -m "feat: Deep Research 运行状态机 hook(确定性预录事件流播放器)"
```

---

### Task 5: 左栏三组件(研究计划 / 步骤时间线 / 来源墙)

**Files:**
- Create: `components/features/deep-research/plan-card.tsx`
- Create: `components/features/deep-research/step-timeline.tsx`
- Create: `components/features/deep-research/source-wall.tsx`

- [ ] **Step 1: 创建 `plan-card.tsx`**

```tsx
import { PenSquare } from "lucide-react";
import { drPlan } from "@/lib/data/deep-research";
import { cn } from "@/lib/utils";
import type { DRSectionState } from "./use-deep-research-run";

const DOT: Record<DRSectionState, string> = {
  todo: "bg-faint/50",
  running: "animate-pulse bg-primary",
  done: "bg-success",
};

/** 研究计划卡 —— 大纲节状态由运行事件流派生(「编辑」为原型展示,无行为) */
export function PlanCard({
  sectionState,
}: {
  sectionState: Record<string, DRSectionState>;
}) {
  return (
    <section className="rounded-2xl bg-card p-4 shadow-card">
      <div className="flex items-center">
        <h2 className="text-sm font-semibold text-ink">研究计划</h2>
        <button
          type="button"
          title="原型阶段仅展示"
          className="ml-auto flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-faint transition-colors hover:bg-chip hover:text-muted"
        >
          <PenSquare className="size-3" />
          编辑
        </button>
      </div>
      <ol className="mt-3 space-y-2.5">
        {drPlan.map((sec) => {
          const state = sectionState[sec.id] ?? "todo";
          return (
            <li key={sec.id} className="flex items-start gap-2.5">
              <span
                className={cn(
                  "mt-1.5 size-2 shrink-0 rounded-full",
                  DOT[state],
                )}
              />
              <div className="min-w-0">
                <p
                  className={cn(
                    "text-[13px] leading-snug",
                    state === "todo" ? "text-faint" : "text-ink",
                  )}
                >
                  {sec.title}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-faint">
                  {sec.query}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
```

- [ ] **Step 2: 创建 `step-timeline.tsx`**

```tsx
import { BookOpen, Brain, PenLine, Search } from "lucide-react";
import type { DRStepEvent, DRStepKind } from "@/types";
import { cn } from "@/lib/utils";

const KIND_ICON: Record<DRStepKind, typeof Search> = {
  search: Search,
  read: BookOpen,
  analyze: Brain,
  write: PenLine,
};

/** 研究过程步骤时间线 —— 随播放逐条出现,最新一条高亮 */
export function StepTimeline({ events }: { events: DRStepEvent[] }) {
  return (
    <section className="rounded-2xl bg-card p-4 shadow-card">
      <h2 className="text-sm font-semibold text-ink">研究过程</h2>
      {events.length === 0 ? (
        <p className="mt-3 text-xs text-faint">正在制定研究计划…</p>
      ) : (
        <ol className="mt-3 space-y-3">
          {events.map((e, i) => {
            const Icon = KIND_ICON[e.kind];
            const latest = i === events.length - 1;
            return (
              <li key={e.offsetMs} className="flex items-start gap-2.5">
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full",
                    latest
                      ? "bg-primary-soft text-primary"
                      : "bg-chip text-faint",
                  )}
                >
                  <Icon className="size-3" />
                </span>
                <p
                  className={cn(
                    "pt-1 text-xs leading-snug",
                    latest ? "text-ink" : "text-muted",
                  )}
                >
                  {e.label}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
```

- [ ] **Step 3: 创建 `source-wall.tsx`**

```tsx
import { drReport } from "@/lib/data/deep-research";

/** 来源墙 —— 已收集来源 chips,hover 显示完整标题与出处 */
export function SourceWall({ count }: { count: number }) {
  const visible = drReport.references.slice(0, count);
  return (
    <section className="rounded-2xl bg-card p-4 shadow-card">
      <div className="flex items-center">
        <h2 className="text-sm font-semibold text-ink">来源墙</h2>
        <span className="ml-auto text-[11px] text-faint">
          {count} / {drReport.references.length}
        </span>
      </div>
      {visible.length === 0 ? (
        <p className="mt-3 text-xs text-faint">检索到的来源将出现在这里…</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {visible.map((s) => (
            <span
              key={s.id}
              title={`${s.title} · ${s.venue}`}
              className="cursor-default rounded-full bg-chip px-2.5 py-1 text-[11px] text-ink-2"
            >
              {s.short}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4: 构建验证**

Run: `pnpm build`
Expected: 编译通过

- [ ] **Step 5: Commit**

```bash
git add components/features/deep-research/plan-card.tsx components/features/deep-research/step-timeline.tsx components/features/deep-research/source-wall.tsx
git commit -m "feat: Deep Research 左栏组件(研究计划/步骤时间线/来源墙)"
```

---

### Task 6: 报告组件 `report-viewer.tsx`

**Files:**
- Create: `components/features/deep-research/report-viewer.tsx`

- [ ] **Step 1: 创建 `report-viewer.tsx`(完整内容)**

```tsx
import { Sparkles } from "lucide-react";
import { withCitations } from "@/lib/citations";
import { drReport } from "@/lib/data/deep-research";
import { cn } from "@/lib/utils";
import type { DRReportSection } from "@/types";
import type { DRSectionState } from "./use-deep-research-run";

/** 性能对比表(与深度搜索答案卡同款样式) */
function ReportTable({
  table,
}: {
  table: NonNullable<DRReportSection["table"]>;
}) {
  return (
    <div>
      <p className="text-[13px] font-medium text-ink">{table.caption}</p>
      <div className="mt-2 overflow-hidden rounded-xl bg-panel px-5 py-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-faint">
              {table.header.map((h) => (
                <th key={h} className="py-2.5 font-normal">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, ri) => {
              const highlighted = ri === table.highlightRow;
              return (
                <tr
                  key={row[0]}
                  className={cn(highlighted && "font-semibold text-primary")}
                >
                  <td className="py-2.5">
                    {withCitations(row[0])}
                    {highlighted && (
                      <span className="ml-1.5 text-xs">· 推荐</span>
                    )}
                  </td>
                  {row.slice(1).map((cell, ci) => (
                    <td key={ci} className="py-2.5">
                      {cell}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Deep Research 报告 —— 报告头 + 章节三态(已生成 / 生成中 / 待生成)+ 参考文献
 * 全部章节完成后出现参考文献列表
 */
export function ReportViewer({
  sectionState,
}: {
  sectionState: Record<string, DRSectionState>;
}) {
  const started = Object.values(sectionState).some((s) => s !== "todo");
  const allDone = Object.values(sectionState).every((s) => s === "done");

  return (
    <article className="rounded-2xl bg-card p-6 shadow-card">
      {/* 品牌行(与深度搜索答案卡同源) */}
      <div className="flex items-center gap-2.5">
        <span className="flex size-8 items-center justify-center rounded-full bg-primary">
          <Sparkles className="size-4 text-white" />
        </span>
        <span className="text-sm font-semibold text-ink">
          深知 AI · Deep Research
        </span>
        <span className="rounded bg-brand-gold px-1.5 py-0.5 text-[10px] font-bold text-ink">
          Pro
        </span>
      </div>

      <header className="mt-4 border-b border-line pb-4">
        <h1 className="text-lg font-bold text-ink">{drReport.title}</h1>
        {started ? (
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {drReport.abstract}
          </p>
        ) : (
          <p className="mt-2 text-sm text-faint">
            研究完成后,这里将生成报告摘要…
          </p>
        )}
        <p className="mt-2 text-xs text-faint">
          阅读 {drReport.stats.read} 篇 · 引用 {drReport.stats.cited} 篇
        </p>
      </header>

      <div className="mt-4 space-y-6">
        {drReport.sections.map((sec) => {
          const state = sectionState[sec.id] ?? "todo";

          if (state === "todo") {
            return (
              <section
                key={sec.id}
                className="rounded-xl border border-dashed border-line p-4 opacity-60"
              >
                <h3 className="text-[15px] font-bold text-faint">
                  {sec.heading}
                </h3>
                <p className="mt-2 text-xs text-faint">待生成</p>
              </section>
            );
          }

          if (state === "running") {
            return (
              <section
                key={sec.id}
                className="rounded-xl border border-primary/40 bg-primary-soft/40 p-4"
              >
                <h3 className="text-[15px] font-bold text-ink">
                  {sec.heading}
                </h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
                  {withCitations(sec.paragraphs[0])}
                  <span className="ml-1 inline-block h-4 w-2 animate-pulse rounded-sm bg-primary align-text-bottom" />
                </p>
              </section>
            );
          }

          return (
            <section key={sec.id}>
              <h3 className="text-[15px] font-bold text-ink">{sec.heading}</h3>
              <div className="mt-2 space-y-4 text-[15px] leading-relaxed text-ink-2">
                {sec.paragraphs.map((p, i) => (
                  <p key={i}>{withCitations(p)}</p>
                ))}
                {sec.table && <ReportTable table={sec.table} />}
                {sec.list && (
                  <ol className="space-y-2.5">
                    {sec.list.map((item, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[11px] font-semibold text-primary">
                          {i + 1}
                        </span>
                        <span>{withCitations(item)}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </section>
          );
        })}

        {allDone && (
          <section className="border-t border-line pt-4">
            <h3 className="text-[15px] font-bold text-ink">参考文献</h3>
            <ol className="mt-2 space-y-1.5">
              {drReport.references.map((r) => (
                <li
                  key={r.id}
                  className="flex gap-2 text-[13px] leading-relaxed text-ink-2"
                >
                  <span className="shrink-0 font-medium text-primary">
                    [{r.id}]
                  </span>
                  <span>
                    {r.title} ·{" "}
                    <span className="text-faint">
                      {r.venue} · {r.author}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </article>
  );
}
```

- [ ] **Step 2: 构建验证**

Run: `pnpm build`
Expected: 编译通过

- [ ] **Step 3: Commit**

```bash
git add components/features/deep-research/report-viewer.tsx
git commit -m "feat: Deep Research 报告组件(章节三态 + 对比表 + 参考文献)"
```

---

### Task 7: Session 工作台骨架 `research-workbench.tsx`

**Files:**
- Create: `components/features/deep-research/research-workbench.tsx`

- [ ] **Step 1: 创建 `research-workbench.tsx`(完整内容)**

```tsx
"use client";

import { useState } from "react";
import {
  ArrowLeft,
  Download,
  PanelLeftClose,
  PanelLeftOpen,
  Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatInput } from "@/components/features/agent/chat-input";
import { cn } from "@/lib/utils";
import { PlanCard } from "./plan-card";
import { ReportViewer } from "./report-viewer";
import { SourceWall } from "./source-wall";
import { StepTimeline } from "./step-timeline";
import { useDeepResearchRun } from "./use-deep-research-run";

/** 耗时格式化:m:ss */
function fmtElapsed(ms: number) {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** Deep Research Session 工作台 —— 顶条 + 左栏(过程)/ 右栏(报告)双栏 */
export function ResearchWorkbench({
  question,
  instant,
  onBack,
}: {
  question: string;
  instant: boolean;
  onBack: () => void;
}) {
  const run = useDeepResearchRun(instant);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="mx-auto max-w-[1280px] px-6 py-5">
      {/* 顶条:返回 / 问题 / 状态 / 耗时 / 导出分享 */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="返回研究列表"
          title="返回研究列表"
          className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted transition-colors hover:bg-card hover:text-ink"
        >
          <ArrowLeft className="size-4" />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
          {question}
        </h1>
        <span
          className={cn(
            "shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium",
            run.phase === "done"
              ? "bg-success-soft text-success"
              : "bg-primary-soft text-primary",
          )}
        >
          {run.phase === "done" ? "已完成" : "研究中"}
        </span>
        <span className="shrink-0 text-xs text-faint">
          {fmtElapsed(run.elapsedMs)}
        </span>
        <div className="ml-2 flex shrink-0 gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg"
            title="原型阶段仅展示"
          >
            <Download className="size-3.5" />
            导出
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg"
            title="原型阶段仅展示"
          >
            <Share2 className="size-3.5" />
            分享
          </Button>
        </div>
      </div>

      {/* 双栏:左过程 / 右报告 */}
      <div className="mt-5 flex items-start gap-5">
        {collapsed ? (
          <div className="w-12 shrink-0">
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              aria-label="展开研究过程"
              title="展开研究过程"
              className="flex size-12 cursor-pointer items-center justify-center rounded-2xl bg-card text-muted shadow-card transition-colors hover:text-ink"
            >
              <PanelLeftOpen className="size-[18px]" strokeWidth={1.8} />
            </button>
          </div>
        ) : (
          <aside className="w-[340px] shrink-0 space-y-4">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                aria-label="收起研究过程"
                title="收起研究过程"
                className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-faint transition-colors hover:bg-card hover:text-muted"
              >
                <PanelLeftClose className="size-4" strokeWidth={1.8} />
              </button>
            </div>
            <PlanCard sectionState={run.sectionState} />
            <StepTimeline events={run.visibleEvents} />
            <SourceWall count={run.visibleSources} />
          </aside>
        )}

        <div className="min-w-0 flex-1 space-y-5">
          <ReportViewer sectionState={run.sectionState} />
          <ChatInput />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 构建验证**

Run: `pnpm build`
Expected: 编译通过

- [ ] **Step 3: Commit**

```bash
git add components/features/deep-research/research-workbench.tsx
git commit -m "feat: Deep Research Session 工作台骨架(顶条 + 可折叠双栏)"
```

---

### Task 8: 入口态组件 `deep-research-home.tsx`

**Files:**
- Create: `components/features/deep-research/deep-research-home.tsx`

- [ ] **Step 1: 创建 `deep-research-home.tsx`(完整内容)**

```tsx
"use client";

import { useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  drHistory,
  drScopeOptions,
  drSuggestions,
} from "@/lib/data/deep-research";
import { cn } from "@/lib/utils";

/** Deep Research 入口态 —— Hero + 研究问题输入 + 建议主题 + 历史研究 */
export function DeepResearchHome({
  onStart,
  onOpenHistory,
}: {
  onStart: (question: string) => void;
  onOpenHistory: () => void;
}) {
  const [value, setValue] = useState("");
  const [scope, setScope] = useState<string>(drScopeOptions[0]);

  const start = () => {
    const q = value.trim();
    if (q) onStart(q);
  };

  return (
    <div className="mx-auto max-w-[760px] px-6 pb-16 pt-14">
      {/* Hero */}
      <div className="text-center">
        <span className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-primary">
          <Sparkles className="size-5 text-white" />
        </span>
        <h1 className="mt-4 text-2xl font-bold text-ink">Deep Research</h1>
        <p className="mt-2 text-sm text-muted">
          围绕一个问题,阅读数十篇文献,产出带引用的研究报告
        </p>
      </div>

      {/* 研究问题输入卡 */}
      <div className="mt-8 rounded-2xl bg-card p-4 shadow-card">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={3}
          autoFocus
          placeholder="输入你的研究问题,例如:扩散模型在机器人策略学习中最近有哪些突破性进展?"
          className="w-full resize-none bg-transparent text-[15px] leading-relaxed text-ink outline-none placeholder:text-faint"
        />
        <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
          {drScopeOptions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScope(s)}
              className={cn(
                "flex h-8 cursor-pointer items-center rounded-full px-3.5 text-[13px] transition-colors",
                scope === s
                  ? "bg-primary-soft font-medium text-primary"
                  : "text-muted hover:bg-chip",
              )}
            >
              {s}
            </button>
          ))}
          <Button
            onClick={start}
            disabled={!value.trim()}
            className="ml-auto rounded-xl"
          >
            开始研究
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>

      {/* 建议主题(点击填入输入框) */}
      <div className="mt-4 flex flex-wrap justify-center gap-2.5">
        {drSuggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setValue(s)}
            className="flex h-9 cursor-pointer items-center rounded-full border border-line bg-card px-4 text-[13px] text-ink-2 transition-colors hover:border-primary hover:text-primary"
          >
            {s}
          </button>
        ))}
      </div>

      {/* 历史研究(原型:全部加载同一份示例报告的完成态) */}
      <p className="mt-10 text-xs text-faint">历史研究</p>
      <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
        {drHistory.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={onOpenHistory}
            className="cursor-pointer rounded-2xl bg-card p-4 text-left shadow-card transition-shadow hover:shadow-pop"
          >
            <div className="flex items-center gap-2">
              <p className="min-w-0 flex-1 truncate text-[14px] font-medium text-ink">
                {item.title}
              </p>
              <span
                className={cn(
                  "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium",
                  item.status === "已完成"
                    ? "bg-success-soft text-success"
                    : "bg-primary-soft text-primary",
                )}
              >
                {item.status}
              </span>
            </div>
            <p className="mt-1.5 text-[11px] text-faint">
              {item.sources} 来源 · {item.time}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 构建验证**

Run: `pnpm build`
Expected: 编译通过

- [ ] **Step 3: Commit**

```bash
git add components/features/deep-research/deep-research-home.tsx
git commit -m "feat: Deep Research 入口态(Hero/输入卡/建议主题/历史研究)"
```

---

### Task 9: 页面装配(视图机 + 路由)

**Files:**
- Create: `components/features/deep-research/deep-research-page.tsx`
- Create: `app/agents/deep-research/page.tsx`

- [ ] **Step 1: 创建 `deep-research-page.tsx`(完整内容)**

```tsx
"use client";

import { useEffect, useState } from "react";
import { drReport } from "@/lib/data/deep-research";
import { DeepResearchHome } from "./deep-research-home";
import { ResearchWorkbench } from "./research-workbench";

/**
 * Deep Research 页主体 —— 视图机:home(入口态)/ session(双栏工作台)
 * URL 参数(客户端解析,沿用 research-board 惯例,规避 useSearchParams 的 Suspense 约束):
 *   ?mode=instant  直接完成态(headless 截图稳定;与 autostart 并存时优先)
 *   ?autostart=1   进入 session 从头播放(演示)
 *   ?q=xxx         预填问题并进入 session 播放;空串则停留 home
 */
export function DeepResearchPageClient() {
  const [view, setView] = useState<"home" | "session">("home");
  const [question, setQuestion] = useState(drReport.question);
  const [instant, setInstant] = useState(false);
  /** 每次进入 session 自增:重挂载工作台,运行从头播放 */
  const [sessionKey, setSessionKey] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") === "instant") {
      setInstant(true);
      setView("session");
    } else if (params.get("autostart")) {
      setView("session");
    } else {
      const q = params.get("q");
      if (q?.trim()) {
        setQuestion(q);
        setView("session");
      }
    }
  }, []);

  const startResearch = (q: string) => {
    setQuestion(q);
    setInstant(false);
    setSessionKey((k) => k + 1);
    setView("session");
  };

  const openHistory = () => {
    setInstant(true);
    setSessionKey((k) => k + 1);
    setView("session");
  };

  if (view === "home") {
    return (
      <DeepResearchHome onStart={startResearch} onOpenHistory={openHistory} />
    );
  }
  return (
    <ResearchWorkbench
      key={sessionKey}
      question={question}
      instant={instant}
      onBack={() => {
        setInstant(false);
        setView("home");
      }}
    />
  );
}
```

- [ ] **Step 2: 创建 `app/agents/deep-research/page.tsx`(完整内容)**

```tsx
import { AppShell } from "@/components/layout/app-shell";
import { DeepResearchPageClient } from "@/components/features/deep-research/deep-research-page";

/**
 * Deep Research 页 `/agents/deep-research` —— 研究报告型双栏工作台:
 * 入口态(新建 / 历史)+ Session 态(左栏过程,右栏报告逐节生成)
 */
export default function DeepResearchPage() {
  return (
    <AppShell>
      <DeepResearchPageClient />
    </AppShell>
  );
}
```

- [ ] **Step 3: 构建验证**

Run: `pnpm build`
Expected: 编译通过,route 表同时出现 `/agents/deep-research` 与 `/agents/deep-search`

- [ ] **Step 4: Commit**

```bash
git add components/features/deep-research/deep-research-page.tsx app/agents/deep-research/page.tsx
git commit -m "feat: Deep Research 页面装配(home/session 视图机 + URL 参数入口)"
```

---

### Task 10: 截图脚本更新 + 全量验证

**Files:**
- Modify: `shot_pages.py:7-15`
- Modify: `shot_themes.py:8-14`

- [ ] **Step 1: shot_pages.py 的 pages 列表追加三条路由**

```python
pages = [
    ('/', 'f_home.png', 1440, 1500),
    ('/submit', 'f_submit.png', 1440, 1650),
    ('/papers/rdt-1b', 'f_paper.png', 1440, 1100),
    ('/scholars', 'f_scholars.png', 1440, 1250),
    ('/scholars/kaiming-he', 'f_scholar_detail.png', 1440, 1500),
    ('/knowledge', 'f_knowledge.png', 1440, 900),
    ('/agents', 'f_agents.png', 1440, 1500),
    ('/agents/deep-search?q=diffusion', 'f_deep_search.png', 1440, 1650),
    ('/agents/deep-research', 'f_dr_home.png', 1440, 1250),
    ('/agents/deep-research?autostart=1', 'f_dr_running.png', 1440, 1500),
    ('/agents/deep-research?mode=instant', 'f_dr_report.png', 1440, 2400),
]
```

说明:`?q=` 用 ASCII 词规避中文 URI 坑;`autostart` 在 virtual-time-budget=6000 下落在进行中态(约 6s/12s,帧位置允许少量偏差);`mode=instant` 直接完成态,稳定可复现。

- [ ] **Step 2: shot_themes.py 的 shots 列表追加夜间两条**

```python
shots = [
    ('/?theme=light', 'theme-home-day.png'),
    ('/?theme=dark', 'theme-home-night.png'),
    ('/agents?theme=dark', 'theme-agents-night.png'),
    ('/scholars?theme=dark', 'theme-scholars-night.png'),
    ('/submit?theme=dark', 'theme-submit-night.png'),
    ('/agents/deep-research?theme=dark', 'theme-dr-home-night.png'),
    ('/agents/deep-research?mode=instant&theme=dark', 'theme-dr-report-night.png'),
]
```

- [ ] **Step 3: 构建 + 起 dev server**

Run: `pnpm build`(预期通过)
Run: `pnpm dev -p 3100`(后台运行,等待 ready)

- [ ] **Step 4: 跑截图脚本**

Run: `python shot_pages.py && python shot_themes.py`
Expected: 每张输出最后一行含 "written to disk"(截图落盘于 Windows %TEMP%,WSL 下用 `cmd.exe /c echo %TEMP%` 解析对应 /mnt/c 路径)

- [ ] **Step 5: 目检关键截图**

用 Read 工具查看(路径为上一步解析出的 %TEMP% 下文件):
- `f_deep_search.png` —— 旧页内容逐块未变(顶栏/提问/AnswerCard/ReferenceGrid/FollowUps/ChatInput)
- `f_dr_home.png` —— 入口态:Hero、输入卡、范围 chips、建议主题、4 张历史卡
- `f_dr_running.png` —— 进行中:左栏计划节状态有区分、时间线已有步骤、右栏至少一节高亮生成中、后续节虚线占位
- `f_dr_report.png` —— 完成态:全部章节实体、参考文献列表、状态徽标「已完成」
- `theme-dr-home-night.png` / `theme-dr-report-night.png` —— 夜间令牌无破版(无白块/无死蓝文字)

发现问题则修复后重跑对应截图,直至目检通过。

- [ ] **Step 6: Commit**

```bash
git add shot_pages.py shot_themes.py
git commit -m "test: 截图脚本覆盖 deep-research 三态与 deep-search 回归"
```

---

## Self-Review 记录

- **Spec 覆盖:** 路由迁移(T1)/ 类型与数据(T2)/ withCitations 抽取(T3)/ 运行 hook(T4)/ 左栏组件(T5)/ 报告组件(T6)/ 工作台(T7)/ 入口态(T8)/ 视图机与 URL 参数(T9)/ 验证(T10);规格「非目标」均未引入任务。
- **类型一致性:** `DRSectionState` 由 hook 文件导出,plan-card / report-viewer 从 `./use-deep-research-run` 导入;`DRReportSection`/`DRStepEvent`/`DRStepKind` 从 `@/types` 导入;`drScopeOptions` 为 `string[]`,home 内 `useState<string>` 匹配。
- **规格偏差说明:** `DRSource` 增加 `short` 字段(来源墙 chip 短名,规格未列出,属实现期发现);规格中的「来源墙与参考文献同用一份数据」不变。
