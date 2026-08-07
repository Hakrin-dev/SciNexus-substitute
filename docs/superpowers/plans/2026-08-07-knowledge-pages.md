# 知识库子页面(专利/基金/机构)实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `/knowledge/patents`、`/knowledge/funding`、`/knowledge/institutions` 三个 stub 页面实现为正式页面(专利/基金=论文库两栏布局;机构=学者页放大版单列大卡片)。

**Architecture:** 方案 A 平行组件 —— 每页独立组件 + 独立 mock 数据文件,不改动 `/knowledge`、`/knowledge/scholars` 现有代码。纯前端 mock,筛选/搜索/排序在 client 容器组件中完成。

**Tech Stack:** Next.js 16.2.12 (Turbopack) + React 19 + TS + Tailwind 4 + framer-motion + zustand(关注持久化)。

**Spec:** `docs/superpowers/specs/2026-08-07-knowledge-pages-design.md`

**注意:** 本项目无测试框架(Vitest 未接入,见项目惯例),验证方式为 `pnpm exec tsc --noEmit`(每个任务)+ `pnpm build` + headless 截图(最后一个任务)。

**样式令牌(均已存在于 globals.css,直接使用):** `bg-card` `bg-panel` `bg-chip` `bg-primary-soft` `bg-success-soft` `bg-danger-soft` `text-ink` `text-ink-2` `text-muted` `text-faint` `text-primary` `border-line` `shadow-card` `shadow-pop`。

---

### Task 1: 类型定义 + 专利 mock 数据

**Files:**
- Modify: `types/index.ts`(文件末尾追加)
- Create: `lib/data/patents.ts`

- [ ] **Step 1: 在 `types/index.ts` 末尾追加三个接口**

```ts
/** 专利 */
export interface Patent {
  id: string;
  /** 专利名称 */
  title: string;
  /** 申请号,如 CN202410123456.7 */
  applicationNo: string;
  /** 申请人 */
  applicant: string;
  /** 公开日 YYYY-MM-DD(字典序即可排序) */
  publishedAt: string;
  /** 技术领域(左栏筛选维度) */
  field: string;
  status: "已授权" | "实质审查" | "已公开" | "PCT";
  kind: "发明" | "实用新型";
  /** 被引次数(排序用) */
  citations: number;
}

/** 项目基金 */
export interface Funding {
  id: string;
  /** 项目名称 */
  title: string;
  /** 批准号 */
  grantNo: string;
  /** 负责人 */
  pi: string;
  /** 依托单位 */
  institution: string;
  /** 资助金额,如 300 万元 */
  amount: string;
  /** 起止年限,如 2024-01 ~ 2027-12 */
  period: string;
  /** 资助类别(左栏筛选维度) */
  category: string;
  status: "在研" | "结题";
}

/** 研究机构 */
export interface Institution {
  id: string;
  nameCn: string;
  nameEn: string;
  /** logo 色块字母,如 THU */
  initials: string;
  logoColor: string;
  type: "高校" | "研究院" | "企业实验室";
  location: string;
  /** 详细介绍:历史沿革、学科优势、代表平台(3~4 句,卡片直接全文展示) */
  intro: string;
  /** 固定 4 项:研究人员 / 年论文 / 总引用 / 国家级平台 */
  stats: { label: string; value: string }[];
  /** 优势方向 tags */
  fields: string[];
  /** 代表性成果一句话 */
  highlight: string;
  followed?: boolean;
  /** 综合排名(升序排序用) */
  rank: number;
  /** 年论文数(降序排序用) */
  papersPerYear: number;
}
```

- [ ] **Step 2: 创建 `lib/data/patents.ts`**

```ts
import type { Patent } from "@/types";

/** 专利库 mock 数据 —— AI 领域,覆盖 5 个技术领域 */
export const patents: Patent[] = [
  {
    id: "p-1",
    title: "一种基于扩散模型的视频帧插值生成方法",
    applicationNo: "CN202410123456.7",
    applicant: "清华大学",
    publishedAt: "2025-03-14",
    field: "计算机视觉",
    status: "实质审查",
    kind: "发明",
    citations: 12,
  },
  {
    id: "p-2",
    title: "大语言模型多智能体协同推理系统及方法",
    applicationNo: "CN202410234567.8",
    applicant: "北京智源人工智能研究院",
    publishedAt: "2025-01-22",
    field: "自然语言处理",
    status: "已授权",
    kind: "发明",
    citations: 38,
  },
  {
    id: "p-3",
    title: "一种长上下文 Transformer 稀疏注意力加速方法",
    applicationNo: "CN202310345678.9",
    applicant: "华为技术有限公司",
    publishedAt: "2024-11-08",
    field: "机器学习",
    status: "已授权",
    kind: "发明",
    citations: 54,
  },
  {
    id: "p-4",
    title: "基于视觉语言模型的机器人抓取姿态生成方法",
    applicationNo: "CN202410456789.0",
    applicant: "上海交通大学",
    publishedAt: "2025-05-30",
    field: "智能机器人",
    status: "已公开",
    kind: "发明",
    citations: 6,
  },
  {
    id: "p-5",
    title: "存算一体 AI 芯片的片上数据调度方法",
    applicationNo: "CN202310567890.1",
    applicant: "中科院计算技术研究所",
    publishedAt: "2024-08-19",
    field: "芯片与系统",
    status: "已授权",
    kind: "发明",
    citations: 41,
  },
  {
    id: "p-6",
    title: "一种多模态医学影像分割模型的训练方法",
    applicationNo: "CN202410678901.2",
    applicant: "腾讯健康(深圳)有限公司",
    publishedAt: "2025-02-11",
    field: "计算机视觉",
    status: "实质审查",
    kind: "发明",
    citations: 9,
  },
  {
    id: "p-7",
    title: "面向检索增强生成的文档切分与索引构建方法",
    applicationNo: "PCT/CN2024/123456",
    applicant: "阿里巴巴达摩院",
    publishedAt: "2024-12-03",
    field: "自然语言处理",
    status: "PCT",
    kind: "发明",
    citations: 23,
  },
  {
    id: "p-8",
    title: "一种模型量化感知训练的混合精度分配装置",
    applicationNo: "CN202420789012.3",
    applicant: "寒武纪科技",
    publishedAt: "2024-09-25",
    field: "芯片与系统",
    status: "已授权",
    kind: "实用新型",
    citations: 15,
  },
  {
    id: "p-9",
    title: "基于强化学习的四足机器人步态自适应控制方法",
    applicationNo: "CN202410890123.4",
    applicant: "宇树科技",
    publishedAt: "2025-06-17",
    field: "智能机器人",
    status: "已公开",
    kind: "发明",
    citations: 4,
  },
  {
    id: "p-10",
    title: "一种联邦学习场景下的梯度压缩传输方法",
    applicationNo: "CN202310901234.5",
    applicant: "北京邮电大学",
    publishedAt: "2024-06-28",
    field: "机器学习",
    status: "已授权",
    kind: "发明",
    citations: 29,
  },
];

/** 法律状态标签(左栏 chips,装饰性,同 LibraryPanel 标签) */
export const patentStatuses = ["已授权", "实质审查", "已公开", "PCT 国际申请"];
```

- [ ] **Step 3: 类型检查**

Run: `pnpm exec tsc --noEmit`
Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add types/index.ts lib/data/patents.ts
git commit -m "feat: 专利/基金/机构类型定义 + 专利 mock 数据"
```

---

### Task 2: 专利库页面(三组件 + 路由)

**Files:**
- Create: `components/features/knowledge/patent-panel.tsx`
- Create: `components/features/knowledge/patent-table.tsx`
- Create: `components/features/knowledge/patents-browser.tsx`
- Modify: `app/knowledge/patents/page.tsx`(整文件替换)

布局对齐 `/knowledge`(`LibraryPanel` + `LibraryTable`):左栏 w-60 固定,右栏 flex-1。`PatentsBrowser` 为唯一 client 组件,持有 query/field/sort 状态;panel 与 table 为受控展示组件,无需 `"use client"`。

- [ ] **Step 1: 创建 `components/features/knowledge/patent-panel.tsx`**

```tsx
import { patentStatuses } from "@/lib/data/patents";
import { cn } from "@/lib/utils";

const TAG_COLORS = [
  "bg-primary-soft text-primary",
  "bg-[#FEF3C7] text-[#B45309] dark:bg-[#3a2f10] dark:text-[#f0c94e]",
  "bg-success-soft text-[#059669] dark:text-success",
  "bg-danger-soft text-danger",
];

export interface PatentFieldCount {
  name: string;
  count: number;
}

/** 专利库左栏 —— 技术领域筛选 + 法律状态标签(布局对齐 LibraryPanel) */
export function PatentPanel({
  fields,
  activeField,
  onFieldChange,
}: {
  fields: PatentFieldCount[];
  /** null = 全部 */
  activeField: string | null;
  onFieldChange: (field: string | null) => void;
}) {
  const total = fields.reduce((sum, f) => sum + f.count, 0);

  return (
    <aside className="w-60 shrink-0 self-stretch border-r border-line bg-card p-5">
      <h2 className="text-[15px] font-bold text-ink">专利库</h2>

      <p className="mt-5 px-1 text-xs text-faint">技术领域</p>
      <ul className="mt-1.5 space-y-0.5">
        {[{ name: "全部", count: total }, ...fields].map((field) => {
          const active =
            field.name === "全部" ? activeField === null : activeField === field.name;
          return (
            <li key={field.name}>
              <button
                type="button"
                onClick={() =>
                  onFieldChange(field.name === "全部" ? null : field.name)
                }
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-sm transition-colors",
                  active
                    ? "bg-primary-soft font-medium text-primary"
                    : "text-ink-2 hover:bg-chip",
                )}
              >
                <span
                  className={cn(
                    "size-3.5 rounded-[4px]",
                    active ? "bg-primary" : "bg-ink-2/70",
                  )}
                />
                <span className="flex-1 text-left">{field.name}</span>
                <span
                  className={cn(
                    "text-xs",
                    active
                      ? "rounded-full bg-primary px-1.5 py-0.5 leading-none text-white"
                      : "text-faint",
                  )}
                >
                  {field.count}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="mt-5 px-1 text-xs text-faint">法律状态</p>
      <div className="mt-2 flex flex-wrap gap-2 px-1">
        {patentStatuses.map((status, i) => (
          <span
            key={status}
            className={cn("rounded-md px-2 py-1 text-xs", TAG_COLORS[i % TAG_COLORS.length])}
          >
            {status}
          </span>
        ))}
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: 创建 `components/features/knowledge/patent-table.tsx`**

```tsx
import { Search } from "lucide-react";
import type { Patent } from "@/types";
import { cn } from "@/lib/utils";

const KIND_TONES: Record<Patent["kind"], string> = {
  发明: "bg-primary-soft text-primary",
  实用新型: "bg-[#FEF3C7] text-[#B45309] dark:bg-[#3a2f10] dark:text-[#f0c94e]",
};

const STATUS_TONES: Record<Patent["status"], string> = {
  已授权: "bg-success-soft text-[#059669] dark:text-success",
  实质审查: "bg-[#FEF3C7] text-[#B45309] dark:bg-[#3a2f10] dark:text-[#f0c94e]",
  已公开: "bg-primary-soft text-primary",
  PCT: "bg-[#EDE9FE] text-[#7C3AED] dark:bg-[#2a2150] dark:text-brand-violet",
};

export type PatentSort = "latest" | "citations";

const SORTS: { key: PatentSort; label: string }[] = [
  { key: "latest", label: "最新公开" },
  { key: "citations", label: "被引最多" },
];

/** 专利表格 —— 名称 / 申请人 / 公开日(布局对齐 LibraryTable) */
export function PatentTable({
  items,
  totalCount,
  query,
  onQueryChange,
  sort,
  onSortChange,
}: {
  items: Patent[];
  totalCount: number;
  query: string;
  onQueryChange: (q: string) => void;
  sort: PatentSort;
  onSortChange: (s: PatentSort) => void;
}) {
  return (
    <div className="min-w-0 flex-1 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">专利库</h1>
          <p className="mt-1 text-xs text-faint">
            共 {totalCount} 件专利 · 上次更新 8 月 1 日
          </p>
        </div>
      </div>

      {/* 搜索 + 排序 */}
      <div className="mt-5 flex items-center gap-3">
        <div className="relative w-full max-w-[420px]">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="搜索专利名称、申请号或申请人…"
            className="h-10 w-full rounded-xl border border-line bg-card pl-10 pr-4 text-sm text-ink outline-none transition-colors placeholder:text-faint focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/15"
          />
        </div>
        <div className="ml-auto flex gap-2">
          {SORTS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => onSortChange(s.key)}
              className={cn(
                "h-9 cursor-pointer rounded-full border px-4 text-[13px] transition-colors",
                sort === s.key
                  ? "border-primary font-medium text-primary"
                  : "border-line bg-card text-muted hover:text-ink-2",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* 表头 */}
      <div className="mt-6 grid grid-cols-[minmax(0,1fr)_200px_110px] items-center gap-4 rounded-xl bg-card px-5 py-3 text-xs text-faint shadow-card">
        <span>专利名称</span>
        <span>申请人</span>
        <span>公开日</span>
      </div>

      {/* 数据行 */}
      <div className="mt-3 space-y-2">
        {items.map((patent) => (
          <div
            key={patent.id}
            className="grid cursor-pointer grid-cols-[minmax(0,1fr)_200px_110px] items-center gap-4 rounded-xl px-5 py-3 transition-colors hover:bg-card"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span
                className={cn(
                  "flex h-11 w-9 shrink-0 items-center justify-center rounded-md text-[10px] font-bold [writing-mode:vertical-lr]",
                  KIND_TONES[patent.kind],
                )}
              >
                {patent.kind}
              </span>
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-[15px] font-semibold text-ink">
                  <span className="truncate">{patent.title}</span>
                  <span
                    className={cn(
                      "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium",
                      STATUS_TONES[patent.status],
                    )}
                  >
                    {patent.status}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-faint">
                  {patent.applicationNo} · 被引 {patent.citations}
                </p>
              </div>
            </div>
            <p className="truncate text-[13px] text-muted">{patent.applicant}</p>
            <p className="text-[13px] text-muted">{patent.publishedAt}</p>
          </div>
        ))}
      </div>

      {items.length === 0 && (
        <div className="mt-3 rounded-2xl bg-card p-12 text-center text-sm text-faint shadow-card">
          未找到匹配的专利
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: 创建 `components/features/knowledge/patents-browser.tsx`**

```tsx
"use client";

import { useMemo, useState } from "react";
import { PatentPanel } from "./patent-panel";
import { PatentTable, type PatentSort } from "./patent-table";
import { useDebounce } from "@/hooks/use-debounce";
import { patents } from "@/lib/data/patents";

/** 专利库容器 —— 持有搜索/领域/排序状态,领域筛选与搜索可叠加 */
export function PatentsBrowser() {
  const [query, setQuery] = useState("");
  const [field, setField] = useState<string | null>(null);
  const [sort, setSort] = useState<PatentSort>("latest");
  const debouncedQuery = useDebounce(query, 300);

  const fields = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of patents) counts.set(p.field, (counts.get(p.field) ?? 0) + 1);
    return [...counts.entries()].map(([name, count]) => ({ name, count }));
  }, []);

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    let list = patents;
    if (field) list = list.filter((p) => p.field === field);
    if (q) {
      list = list.filter((p) =>
        [p.title, p.applicationNo, p.applicant]
          .join(" ")
          .toLowerCase()
          .includes(q),
      );
    }
    return [...list].sort((a, b) =>
      sort === "latest"
        ? b.publishedAt.localeCompare(a.publishedAt)
        : b.citations - a.citations,
    );
  }, [debouncedQuery, field, sort]);

  return (
    <>
      <PatentPanel fields={fields} activeField={field} onFieldChange={setField} />
      <PatentTable
        items={filtered}
        totalCount={patents.length}
        query={query}
        onQueryChange={setQuery}
        sort={sort}
        onSortChange={setSort}
      />
    </>
  );
}
```

- [ ] **Step 4: 替换 `app/knowledge/patents/page.tsx`**

```tsx
import { AppShell } from "@/components/layout/app-shell";
import { PatentsBrowser } from "@/components/features/knowledge/patents-browser";

/** 专利库 `/knowledge/patents` —— 两栏布局,对齐 `/knowledge` 论文库 */
export default function PatentsPage() {
  return (
    <AppShell>
      <div className="flex min-h-[calc(100vh)] items-stretch">
        <PatentsBrowser />
      </div>
    </AppShell>
  );
}
```

注意:外层 flex 容器的直接子元素需要都能拉伸。`PatentsBrowser` 返回 Fragment(aside + div),Flex 布局直接作用于这两个子元素,与 `/knowledge` 行为一致。若 aside 未拉伸,检查 `items-stretch` 与 `self-stretch`(panel 已带 `self-stretch`)。

- [ ] **Step 5: 类型检查 + 页面编译验证**

Run: `pnpm exec tsc --noEmit`
Expected: 无错误

Run(dev server 运行中): `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/knowledge/patents`
Expected: `200`

- [ ] **Step 6: Commit**

```bash
git add components/features/knowledge/patent-panel.tsx components/features/knowledge/patent-table.tsx components/features/knowledge/patents-browser.tsx app/knowledge/patents/page.tsx
git commit -m "feat: 专利库页面(两栏布局 + 领域筛选/搜索/排序)"
```

---

### Task 3: 基金 mock 数据

**Files:**
- Create: `lib/data/funding.ts`

- [ ] **Step 1: 创建 `lib/data/funding.ts`**

```ts
import type { Funding } from "@/types";

/** 项目基金库 mock 数据 —— 覆盖 4 类资助来源 */
export const fundings: Funding[] = [
  {
    id: "f-1",
    title: "面向科学发现的大模型智能体关键技术研究",
    grantNo: "62476231",
    pi: "王浩然",
    institution: "清华大学",
    amount: "300 万元",
    period: "2025-01 ~ 2028-12",
    category: "国家自然科学基金",
    status: "在研",
  },
  {
    id: "f-2",
    title: "新一代人工智能重大专项:多模态基础模型",
    grantNo: "2024ZD0119900",
    pi: "李慕华",
    institution: "中科院自动化研究所",
    amount: "1200 万元",
    period: "2024-12 ~ 2027-11",
    category: "国家重点研发计划",
    status: "在研",
  },
  {
    id: "f-3",
    title: "长视频生成扩散模型的效率优化研究",
    grantNo: "62304215",
    pi: "陈立",
    institution: "浙江大学",
    amount: "30 万元",
    period: "2024-01 ~ 2026-12",
    category: "国家自然科学基金",
    status: "在研",
  },
  {
    id: "f-4",
    title: "具身智能机器人操作系统研发与产业化",
    grantNo: "2024A1515012345",
    pi: "周彤",
    institution: "广东省科学技术厅",
    amount: "500 万元",
    period: "2024-07 ~ 2027-06",
    category: "省市项目",
    status: "在研",
  },
  {
    id: "f-5",
    title: "大模型训练集群的存算协同优化",
    grantNo: "62227801",
    pi: "刘洋",
    institution: "北京大学",
    amount: "500 万元",
    period: "2023-01 ~ 2027-12",
    category: "国家自然科学基金",
    status: "在研",
  },
  {
    id: "f-6",
    title: "工业质检视觉大模型关键技术",
    grantNo: "2023YFB3904100",
    pi: "赵铭",
    institution: "商汤科技",
    amount: "800 万元",
    period: "2023-11 ~ 2026-10",
    category: "国家重点研发计划",
    status: "结题",
  },
  {
    id: "f-7",
    title: "面向智慧医疗的联邦学习平台",
    grantNo: "2023-JC-YB-452",
    pi: "吴倩",
    institution: "上海市科学技术委员会",
    amount: "200 万元",
    period: "2023-05 ~ 2025-04",
    category: "省市项目",
    status: "结题",
  },
  {
    id: "f-8",
    title: "端侧大模型推理加速联合研究",
    grantNo: "HX-2024-0098",
    pi: "郑凯",
    institution: "华为-清华联合实验室",
    amount: "600 万元",
    period: "2024-09 ~ 2026-08",
    category: "企业横向",
    status: "在研",
  },
  {
    id: "f-9",
    title: "科学文献知识图谱构建与推理",
    grantNo: "U23B2019",
    pi: "孙逸",
    institution: "复旦大学",
    amount: "250 万元",
    period: "2024-01 ~ 2027-12",
    category: "国家自然科学基金",
    status: "在研",
  },
  {
    id: "f-10",
    title: "自动驾驶仿真环境生成技术合作开发",
    grantNo: "HX-2023-0156",
    pi: "何斌",
    institution: "同济大学",
    amount: "450 万元",
    period: "2023-03 ~ 2025-02",
    category: "企业横向",
    status: "结题",
  },
];

/** 项目状态标签(左栏 chips,装饰性) */
export const fundingStatuses = ["在研", "结题"];
```

- [ ] **Step 2: 类型检查**

Run: `pnpm exec tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add lib/data/funding.ts
git commit -m "feat: 项目基金 mock 数据"
```

---

### Task 4: 项目基金库页面(三组件 + 路由)

**Files:**
- Create: `components/features/knowledge/funding-panel.tsx`
- Create: `components/features/knowledge/funding-table.tsx`
- Create: `components/features/knowledge/funding-browser.tsx`
- Modify: `app/knowledge/funding/page.tsx`(整文件替换)

结构与 Task 2 完全平行。

- [ ] **Step 1: 创建 `components/features/knowledge/funding-panel.tsx`**

```tsx
import { fundingStatuses } from "@/lib/data/funding";
import { cn } from "@/lib/utils";

const TAG_COLORS = [
  "bg-success-soft text-[#059669] dark:text-success",
  "bg-chip text-muted",
];

export interface FundingCategoryCount {
  name: string;
  count: number;
}

/** 基金库左栏 —— 资助类别筛选 + 项目状态标签 */
export function FundingPanel({
  categories,
  activeCategory,
  onCategoryChange,
}: {
  categories: FundingCategoryCount[];
  /** null = 全部 */
  activeCategory: string | null;
  onCategoryChange: (category: string | null) => void;
}) {
  const total = categories.reduce((sum, c) => sum + c.count, 0);

  return (
    <aside className="w-60 shrink-0 self-stretch border-r border-line bg-card p-5">
      <h2 className="text-[15px] font-bold text-ink">项目基金库</h2>

      <p className="mt-5 px-1 text-xs text-faint">资助类别</p>
      <ul className="mt-1.5 space-y-0.5">
        {[{ name: "全部", count: total }, ...categories].map((category) => {
          const active =
            category.name === "全部"
              ? activeCategory === null
              : activeCategory === category.name;
          return (
            <li key={category.name}>
              <button
                type="button"
                onClick={() =>
                  onCategoryChange(category.name === "全部" ? null : category.name)
                }
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-sm transition-colors",
                  active
                    ? "bg-primary-soft font-medium text-primary"
                    : "text-ink-2 hover:bg-chip",
                )}
              >
                <span
                  className={cn(
                    "size-3.5 rounded-[4px]",
                    active ? "bg-primary" : "bg-ink-2/70",
                  )}
                />
                <span className="flex-1 text-left">{category.name}</span>
                <span
                  className={cn(
                    "text-xs",
                    active
                      ? "rounded-full bg-primary px-1.5 py-0.5 leading-none text-white"
                      : "text-faint",
                  )}
                >
                  {category.count}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="mt-5 px-1 text-xs text-faint">项目状态</p>
      <div className="mt-2 flex flex-wrap gap-2 px-1">
        {fundingStatuses.map((status, i) => (
          <span
            key={status}
            className={cn("rounded-md px-2 py-1 text-xs", TAG_COLORS[i % TAG_COLORS.length])}
          >
            {status}
          </span>
        ))}
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: 创建 `components/features/knowledge/funding-table.tsx`**

```tsx
import { Search } from "lucide-react";
import type { Funding } from "@/types";
import { cn } from "@/lib/utils";

const STATUS_TONES: Record<Funding["status"], string> = {
  在研: "bg-success-soft text-[#059669] dark:text-success",
  结题: "bg-chip text-muted",
};

/** 基金表格 —— 项目名称 / 负责人·依托单位 / 资助金额 / 起止年限 */
export function FundingTable({
  items,
  totalCount,
  query,
  onQueryChange,
}: {
  items: Funding[];
  totalCount: number;
  query: string;
  onQueryChange: (q: string) => void;
}) {
  return (
    <div className="min-w-0 flex-1 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">项目基金库</h1>
          <p className="mt-1 text-xs text-faint">
            共 {totalCount} 个项目 · 上次更新 8 月 1 日
          </p>
        </div>
      </div>

      {/* 搜索 */}
      <div className="mt-5">
        <div className="relative w-full max-w-[420px]">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="搜索项目名称、批准号或负责人…"
            className="h-10 w-full rounded-xl border border-line bg-card pl-10 pr-4 text-sm text-ink outline-none transition-colors placeholder:text-faint focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/15"
          />
        </div>
      </div>

      {/* 表头 */}
      <div className="mt-6 grid grid-cols-[minmax(0,1fr)_220px_110px_150px] items-center gap-4 rounded-xl bg-card px-5 py-3 text-xs text-faint shadow-card">
        <span>项目名称</span>
        <span>负责人 · 依托单位</span>
        <span>资助金额</span>
        <span>起止年限</span>
      </div>

      {/* 数据行 */}
      <div className="mt-3 space-y-2">
        {items.map((funding) => (
          <div
            key={funding.id}
            className="grid cursor-pointer grid-cols-[minmax(0,1fr)_220px_110px_150px] items-center gap-4 rounded-xl px-5 py-3 transition-colors hover:bg-card"
          >
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-[15px] font-semibold text-ink">
                <span className="truncate">{funding.title}</span>
                <span
                  className={cn(
                    "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium",
                    STATUS_TONES[funding.status],
                  )}
                >
                  {funding.status}
                </span>
              </p>
              <p className="mt-0.5 text-xs text-faint">
                批准号 {funding.grantNo} · {funding.category}
              </p>
            </div>
            <p className="truncate text-[13px] text-muted">
              {funding.pi} · {funding.institution}
            </p>
            <p className="text-[13px] font-medium text-ink-2">{funding.amount}</p>
            <p className="text-[13px] text-muted">{funding.period}</p>
          </div>
        ))}
      </div>

      {items.length === 0 && (
        <div className="mt-3 rounded-2xl bg-card p-12 text-center text-sm text-faint shadow-card">
          未找到匹配的项目
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: 创建 `components/features/knowledge/funding-browser.tsx`**

```tsx
"use client";

import { useMemo, useState } from "react";
import { FundingPanel } from "./funding-panel";
import { FundingTable } from "./funding-table";
import { useDebounce } from "@/hooks/use-debounce";
import { fundings } from "@/lib/data/funding";

/** 基金库容器 —— 持有搜索/类别状态 */
export function FundingBrowser() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const debouncedQuery = useDebounce(query, 300);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const f of fundings) counts.set(f.category, (counts.get(f.category) ?? 0) + 1);
    return [...counts.entries()].map(([name, count]) => ({ name, count }));
  }, []);

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    let list = fundings;
    if (category) list = list.filter((f) => f.category === category);
    if (q) {
      list = list.filter((f) =>
        [f.title, f.grantNo, f.pi, f.institution]
          .join(" ")
          .toLowerCase()
          .includes(q),
      );
    }
    return list;
  }, [debouncedQuery, category]);

  return (
    <>
      <FundingPanel
        categories={categories}
        activeCategory={category}
        onCategoryChange={setCategory}
      />
      <FundingTable
        items={filtered}
        totalCount={fundings.length}
        query={query}
        onQueryChange={setQuery}
      />
    </>
  );
}
```

- [ ] **Step 4: 替换 `app/knowledge/funding/page.tsx`**

```tsx
import { AppShell } from "@/components/layout/app-shell";
import { FundingBrowser } from "@/components/features/knowledge/funding-browser";

/** 项目基金库 `/knowledge/funding` —— 两栏布局,对齐 `/knowledge` 论文库 */
export default function FundingPage() {
  return (
    <AppShell>
      <div className="flex min-h-[calc(100vh)] items-stretch">
        <FundingBrowser />
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 5: 类型检查 + 页面编译验证**

Run: `pnpm exec tsc --noEmit`
Expected: 无错误

Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/knowledge/funding`
Expected: `200`

- [ ] **Step 6: Commit**

```bash
git add components/features/knowledge/funding-panel.tsx components/features/knowledge/funding-table.tsx components/features/knowledge/funding-browser.tsx app/knowledge/funding/page.tsx lib/data/funding.ts
git commit -m "feat: 项目基金库页面(两栏布局 + 类别筛选/搜索)"
```

---

### Task 5: 研究机构页面(数据 + 两组件 + 路由)

**Files:**
- Create: `lib/data/institutions.ts`
- Create: `components/features/institution/institution-card.tsx`
- Create: `components/features/institution/institutions-browser.tsx`
- Modify: `app/knowledge/institutions/page.tsx`(整文件替换)

骨架参考 `ScholarsBrowser`(横幅 + 搜索 + 排序 chips + 卡片流),但无左侧 DirectionFilter、单列大卡片。关注按钮复用 `FollowButton`,id 加 `inst:` 前缀写入同一 zustand store,不与学者 id 冲突。

- [ ] **Step 1: 创建 `lib/data/institutions.ts`**

```ts
import type { Institution } from "@/types";

/** 研究机构 mock 数据 —— 高校 / 研究院 / 企业实验室各覆盖 */
export const institutions: Institution[] = [
  {
    id: "tsinghua",
    nameCn: "清华大学",
    nameEn: "Tsinghua University",
    initials: "THU",
    logoColor: "#002FA7",
    type: "高校",
    location: "中国 · 北京",
    intro:
      "清华大学计算机系始建于 1958 年,是国内计算机学科的发源地之一。在人工智能领域拥有智能技术与系统国家重点实验室、清华 AI 研究院(THUAI)等平台,姚期智院士领衔的交叉信息研究院(姚班)培养了大批顶尖 AI 人才。近年来在大模型(智谱 GLM 系列源头)、类脑计算、具身智能方向产出持续领先。",
    stats: [
      { label: "研究人员", value: "3,800+" },
      { label: "年论文", value: "1,200+" },
      { label: "总引用", value: "2.4M" },
      { label: "国家级平台", value: "12" },
    ],
    fields: ["大语言模型", "计算机视觉", "类脑计算", "具身智能"],
    highlight: "代表性成果:GLM 系列大模型、天机芯类脑芯片(《Nature》封面)。",
    followed: true,
    rank: 1,
    papersPerYear: 1200,
  },
  {
    id: "cas-ict",
    nameCn: "中科院计算技术研究所",
    nameEn: "Institute of Computing Technology, CAS",
    initials: "ICT",
    logoColor: "#0E7490",
    type: "研究院",
    location: "中国 · 北京",
    intro:
      "中科院计算所成立于 1956 年,是中国计算机事业的摇篮,研制了我国第一台通用数字电子计算机。孵化了联想、曙光、寒武纪等企业。在处理器芯片(龙芯、寒武纪)、智能计算系统方向处于国内领先地位,拥有处理器芯片全国重点实验室。",
    stats: [
      { label: "研究人员", value: "1,600+" },
      { label: "年论文", value: "600+" },
      { label: "总引用", value: "890k" },
      { label: "国家级平台", value: "8" },
    ],
    fields: ["AI 芯片", "智能计算系统", "体系结构", "数据科学"],
    highlight: "代表性成果:寒武纪系列 AI 处理器、龙芯 CPU。",
    rank: 4,
    papersPerYear: 600,
  },
  {
    id: "pku",
    nameCn: "北京大学",
    nameEn: "Peking University",
    initials: "PKU",
    logoColor: "#B91C1C",
    type: "高校",
    location: "中国 · 北京",
    intro:
      "北京大学信息科学技术学院与智能学院在机器学习理论、计算机视觉、自然语言处理方向实力雄厚。王选计算机研究所曾以汉字激光照排技术闻名。近年依托北京通用人工智能研究院(BIGAI)在通用人工智能、多模态理解方向布局深入。",
    stats: [
      { label: "研究人员", value: "2,900+" },
      { label: "年论文", value: "900+" },
      { label: "总引用", value: "1.6M" },
      { label: "国家级平台", value: "9" },
    ],
    fields: ["机器学习理论", "多模态理解", "NLP", "智能系统"],
    highlight: "代表性成果:汉字激光照排系统、通用智能体 Tong 系列。",
    rank: 3,
    papersPerYear: 900,
  },
  {
    id: "mit-csail",
    nameCn: "MIT 计算机科学与人工智能实验室",
    nameEn: "MIT CSAIL",
    initials: "CSAIL",
    logoColor: "#A31F34",
    type: "高校",
    location: "美国 · 剑桥",
    intro:
      "CSAIL 是 MIT 最大的跨学科实验室,由 1963 年的 Project MAC 演变而来,2003 年合并 AI Lab 与 LCS 而成。诞生了分时操作系统、RSA 加密、万维网雏形等奠基性成果。现有 60+ 研究组,覆盖机器人、机器学习、系统、理论计算全谱系,何恺明等知名学者在此任教。",
    stats: [
      { label: "研究人员", value: "1,700+" },
      { label: "年论文", value: "800+" },
      { label: "总引用", value: "3.1M" },
      { label: "国家级平台", value: "15" },
    ],
    fields: ["机器人", "表征学习", "系统与网络", "计算理论"],
    highlight: "代表性成果:ResNet(何恺明)、RSA 加密算法、World Wide Web 发源地之一。",
    rank: 2,
    papersPerYear: 800,
  },
  {
    id: "stanford-sail",
    nameCn: "斯坦福人工智能实验室",
    nameEn: "Stanford AI Lab (SAIL)",
    initials: "SAIL",
    logoColor: "#8C1515",
    type: "高校",
    location: "美国 · 斯坦福",
    intro:
      "SAIL 由 John McCarthy 于 1963 年创立,是人工智能学科的发源地之一('Artificial Intelligence'一词的诞生地)。李飞飞曾任实验室主任并创立 ImageNet。当前在基础模型(CRFM/HELM 评测体系)、机器人学习、AI 医疗方向引领全球研究。",
    stats: [
      { label: "研究人员", value: "900+" },
      { label: "年论文", value: "500+" },
      { label: "总引用", value: "2.2M" },
      { label: "国家级平台", value: "7" },
    ],
    fields: ["基础模型", "机器人学习", "AI 医疗", "计算机视觉"],
    highlight: "代表性成果:ImageNet、HELM 基础模型评测体系、Stanford Doggo 机器人。",
    rank: 5,
    papersPerYear: 500,
  },
  {
    id: "deepmind",
    nameCn: "Google DeepMind",
    nameEn: "Google DeepMind",
    initials: "DM",
    logoColor: "#4285F4",
    type: "企业实验室",
    location: "英国 · 伦敦",
    intro:
      "DeepMind 2010 年成立于伦敦,2014 年被 Google 收购,2023 年与 Google Brain 合并为 Google DeepMind。以 AlphaGo、AlphaFold(2024 诺贝尔化学奖)、Gemini 系列模型闻名,是强化学习与科学 AI(AI for Science)的标杆实验室。CEO Demis Hassabis 为认知神经科学背景的 AI 先驱。",
    stats: [
      { label: "研究人员", value: "2,500+" },
      { label: "年论文", value: "700+" },
      { label: "总引用", value: "1.9M" },
      { label: "国家级平台", value: "—" },
    ],
    fields: ["强化学习", "蛋白质结构预测", "基础模型", "AI for Science"],
    highlight: "代表性成果:AlphaGo、AlphaFold(诺贝尔化学奖)、Gemini 系列。",
    rank: 6,
    papersPerYear: 700,
  },
  {
    id: "openai",
    nameCn: "OpenAI",
    nameEn: "OpenAI",
    initials: "OAI",
    logoColor: "#10A37F",
    type: "企业实验室",
    location: "美国 · 旧金山",
    intro:
      "OpenAI 2015 年由 Sam Altman、Elon Musk、Ilya Sutskever 等创立,使命是确保通用人工智能惠及全人类。GPT 系列模型开启了生成式 AI 时代,ChatGPT 成为史上增长最快的消费级应用。研究方向覆盖对齐、推理模型(o 系列)、多模态与智能体。",
    stats: [
      { label: "研究人员", value: "1,200+" },
      { label: "年论文", value: "200+" },
      { label: "总引用", value: "1.4M" },
      { label: "国家级平台", value: "—" },
    ],
    fields: ["大语言模型", "对齐与安全", "多模态", "智能体"],
    highlight: "代表性成果:GPT 系列、ChatGPT、DALL·E、Sora。",
    followed: true,
    rank: 7,
    papersPerYear: 200,
  },
  {
    id: "mila",
    nameCn: "Mila 魁北克人工智能研究所",
    nameEn: "Mila - Quebec AI Institute",
    initials: "MILA",
    logoColor: "#F59E0B",
    type: "研究院",
    location: "加拿大 · 蒙特利尔",
    intro:
      "Mila 由图灵奖得主 Yoshua Bengio 于 1993 年创立,是全球最大的深度学习学术研究中心之一,聚集了 1,000+ 研究人员。在生成模型(GAN 诞生地之一)、因果推断、AI 气候与医疗应用方向特色鲜明,与蒙特利尔大学、McGill 大学深度联动。",
    stats: [
      { label: "研究人员", value: "1,000+" },
      { label: "年论文", value: "450+" },
      { label: "总引用", value: "980k" },
      { label: "国家级平台", value: "3" },
    ],
    fields: ["深度学习", "因果推断", "生成模型", "AI 公益应用"],
    highlight: "代表性成果:GAN 早期工作、神经机器翻译注意力机制奠基性论文。",
    rank: 8,
    papersPerYear: 450,
  },
];
```

- [ ] **Step 2: 创建 `components/features/institution/institution-card.tsx`**

```tsx
"use client";

import { motion } from "framer-motion";
import { Award, MapPin } from "lucide-react";
import { FollowButton } from "@/components/features/scholar/follow-button";
import type { Institution } from "@/types";

const TYPE_TONES: Record<Institution["type"], string> = {
  高校: "bg-primary-soft text-primary",
  研究院: "bg-success-soft text-[#059669] dark:text-success",
  企业实验室: "bg-[#FEF3C7] text-[#B45309] dark:bg-[#3a2f10] dark:text-[#f0c94e]",
};

/** 机构卡片 —— 学者卡片的放大版:单列、4 项统计、完整简介,卡片即详情 */
export function InstitutionCard({
  institution,
  index,
}: {
  institution: Institution;
  index: number;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06 }}
      className="rounded-2xl bg-card p-8 shadow-card transition-shadow hover:shadow-pop"
    >
      <div className="flex gap-6">
        <span
          className="flex size-20 shrink-0 items-center justify-center rounded-2xl text-xl font-bold text-white"
          style={{ backgroundColor: institution.logoColor }}
        >
          {institution.initials}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-ink">{institution.nameCn}</h3>
              <p className="mt-0.5 text-sm text-muted">{institution.nameEn}</p>
            </div>
            <FollowButton
              scholarId={`inst:${institution.id}`}
              defaultFollowing={institution.followed}
            />
          </div>

          <p className="mt-2.5 flex items-center gap-2 text-xs text-muted">
            <span
              className={`rounded-md px-2 py-0.5 font-medium ${TYPE_TONES[institution.type]}`}
            >
              {institution.type}
            </span>
            <MapPin className="size-3.5" />
            {institution.location}
          </p>

          <p className="mt-4 text-[14px] leading-relaxed text-muted">
            {institution.intro}
          </p>

          <div className="mt-5 grid grid-cols-4 gap-4 rounded-xl bg-panel px-5 py-4">
            {institution.stats.map((stat) => (
              <div key={stat.label}>
                <p className="text-lg font-bold text-ink">{stat.value}</p>
                <p className="mt-0.5 text-xs text-faint">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {institution.fields.map((field) => (
              <span
                key={field}
                className="rounded-md bg-chip px-2 py-1 text-xs text-muted"
              >
                {field}
              </span>
            ))}
          </div>

          <p className="mt-3 flex items-start gap-2 text-[13px] text-muted">
            <Award className="mt-0.5 size-4 shrink-0 text-primary" />
            {institution.highlight}
          </p>
        </div>
      </div>
    </motion.article>
  );
}
```

- [ ] **Step 3: 创建 `components/features/institution/institutions-browser.tsx`**

```tsx
"use client";

import { useMemo, useState } from "react";
import { Building2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InstitutionCard } from "./institution-card";
import { useDebounce } from "@/hooks/use-debounce";
import { institutions } from "@/lib/data/institutions";
import { cn } from "@/lib/utils";

const SORTS = [
  { key: "rank", label: "综合排名" },
  { key: "papers", label: "论文数" },
  { key: "followed", label: "已关注" },
];

/** 机构浏览区 —— 骨架对齐 ScholarsBrowser(横幅 + 搜索 + 排序),单列大卡片 */
export function InstitutionsBrowser() {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("rank");
  const debouncedQuery = useDebounce(query, 300);

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    let list = institutions;
    if (sort === "followed") list = list.filter((i) => i.followed);
    if (q) {
      list = list.filter((i) =>
        [i.nameCn, i.nameEn, i.location, ...i.fields]
          .join(" ")
          .toLowerCase()
          .includes(q),
      );
    }
    return [...list].sort((a, b) =>
      sort === "papers" ? b.papersPerYear - a.papersPerYear : a.rank - b.rank,
    );
  }, [debouncedQuery, sort]);

  return (
    <div className="space-y-5">
      {/* 顶部横幅 */}
      <section className="flex items-center justify-between rounded-2xl bg-card px-8 py-7 shadow-card">
        <div className="flex items-center gap-4">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-primary-soft">
            <Building2 className="size-6 text-primary" />
          </span>
          <div>
            <p className="text-[15px] font-semibold text-ink">研究机构图谱</p>
            <p className="mt-0.5 text-xs text-muted">
              追踪全球顶尖高校、研究院与企业实验室的研究动态
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          className="rounded-full border-primary/40 text-primary hover:bg-primary-soft"
        >
          探索机构合作网络
          <span aria-hidden>→</span>
        </Button>
      </section>

      {/* 搜索 + 排序 */}
      <div className="flex items-center gap-3">
        <div className="relative w-full max-w-[420px]">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索机构名称、地点或研究方向…"
            className="h-10 w-full rounded-xl border border-line bg-card pl-10 pr-4 text-sm text-ink outline-none transition-colors placeholder:text-faint focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/15"
          />
        </div>
        <div className="ml-auto flex gap-2">
          {SORTS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSort(s.key)}
              className={cn(
                "h-9 cursor-pointer rounded-full border px-4 text-[13px] transition-colors",
                sort === s.key
                  ? "border-primary font-medium text-primary"
                  : "border-line bg-card text-muted hover:text-ink-2",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* 单列大卡片 */}
      <div className="space-y-6">
        {filtered.map((institution, i) => (
          <InstitutionCard key={institution.id} institution={institution} index={i} />
        ))}
      </div>
      {filtered.length === 0 && (
        <div className="rounded-2xl bg-card p-12 text-center text-sm text-faint shadow-card">
          未找到匹配的机构
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: 替换 `app/knowledge/institutions/page.tsx`**

```tsx
import { AppShell } from "@/components/layout/app-shell";
import { InstitutionsBrowser } from "@/components/features/institution/institutions-browser";

/** 研究机构 `/knowledge/institutions` —— 单列大卡片,参考学者关系页 */
export default function InstitutionsPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-[960px] px-8 py-6">
        <InstitutionsBrowser />
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 5: 类型检查 + 页面编译验证**

Run: `pnpm exec tsc --noEmit`
Expected: 无错误

Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/knowledge/institutions`
Expected: `200`

- [ ] **Step 6: Commit**

```bash
git add lib/data/institutions.ts components/features/institution/ app/knowledge/institutions/page.tsx
git commit -m "feat: 研究机构页面(单列大卡片 + 搜索/排序/关注)"
```

---

### Task 6: 全量构建 + 截图验证

**Files:** 无新增,纯验证。

- [ ] **Step 1: 全量构建**

Run: `pnpm build`
Expected: 编译通过,无 TS / lint 错误;路由表包含 `/knowledge/patents`、`/knowledge/funding`、`/knowledge/institutions`

若 pnpm 前置依赖检查失败,用 `pnpm exec next build --turbopack` 直跑(已知 pnpm 11 行为)。

- [ ] **Step 2: 截图核验三个页面**

用 headless Edge 截 `/knowledge/patents`、`/knowledge/funding`、`/knowledge/institutions`(含暗色模式各一张,通过 `--force-dark-mode` 或等待主题 store 默认),要点:

- 截图前先在浏览器实际打开一次页面预热编译(dev 按需编译会让 framer-motion 入场动画在截图时未完成,卡片"消失")
- 或使用 `next start` 生产构建截图;`--virtual-time-budget` 给 6000~15000
- 截图只能写 `%TEMP%`(WSL 下写 /tmp 或 Windows TEMP 挂载路径),不能写项目目录

人工核验清单:
- patents:左栏领域可点击筛选、计数正确;搜索可过滤;排序切换生效;状态徽章颜色正确
- funding:同上(类别筛选);金额列加粗;状态徽章 在研绿/结题灰
- institutions:单列大卡片;4 项统计网格;关注按钮可切换并持久化(刷新后保持);排序"已关注"只显示 2 家(清华、OpenAI);日夜模式下对比度正常

- [ ] **Step 3: 更新记忆文件**

更新 `shenzhi-conversion-status` 记忆:路由清单中三个 knowledge 子页面已从 stub 转为正式页面。

- [ ] **Step 4: 最终 Commit(如有修复)**

```bash
git add -A
git commit -m "fix: 截图核验后的样式修正"
```
