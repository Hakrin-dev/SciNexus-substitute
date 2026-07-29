# 知识图谱(公域 + 私域)实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 论文详情页 Similar 面板新增公域知识图谱(独立三栏页 `/papers/[id]/graph`),知识库中间栏新增私域知识图谱(分层双色页 `/knowledge/graph`)。

**Architecture:** 确定性纯函数布局(同心环 / 双层带)+ 纯 SVG 渲染,零新增依赖;布局在客户端组件内 useMemo 计算(避免 Map 跨 RSC 边界序列化);页面为服务端组件,只传可序列化的图数据。规范见 `docs/superpowers/specs/2026-07-29-knowledge-graph-design.md`。

**Tech Stack:** Next.js 16 + React 19 + TS strict、Tailwind 4 令牌(含 .dark)、Framer Motion、lucide-react。

**注意:** 本目录不是 git 仓库 —— 每个 Task 的收尾检查点为 `pnpm exec tsc --noEmit` 通过(替代 commit)。项目无测试框架,纯函数以类型检查 + SSR 内容验证为准。

---

### Task 1: 图谱类型 + 布局引擎

**Files:**
- Modify: `types/index.ts`(文件末尾追加)
- Create: `lib/graph-layout.ts`

- [ ] **Step 1: 追加类型到 `types/index.ts` 末尾**(注意:替代规范中的 `label` 字段,只保留 `labelLines`,避免冗余)

```ts
/** 知识图谱节点 */
export interface GraphNode {
  id: string;
  /** 圆下两行标签:公域 ["Liu", "2024"],私域 ["扩散策略", "2025"] */
  labelLines: [string, string];
  /** 0~1 关系强度 → 圆半径与透明度 */
  weight: number;
  year: number;
  title: string;
  authors: string;
  venue: string;
  citations: string;
  abstract: string;
  /** 右栏「查看论文详情」跳转目标(/papers/[paperId]) */
  paperId?: string;
  /** 私域分层;公域不设 */
  layer?: "mine" | "folder";
}

export interface GraphEdge {
  source: string;
  target: string;
  strength: number;
  /** 私域跨层边(虚线) */
  crossLayer?: boolean;
}

export interface PaperGraph {
  origin: GraphNode;
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** 左栏列表顺序 */
  relatedIds: string[];
}
```

- [ ] **Step 2: 创建 `lib/graph-layout.ts`**

```ts
import type { PaperGraph } from "@/types";

/** 画布(viewBox)尺寸 */
export const VIEW_W = 1080;
export const VIEW_H = 820;
const CX = VIEW_W / 2;
const CY = VIEW_H / 2 - 40; // 370,底部留给标签与图例

export interface PlacedNode {
  x: number;
  y: number;
  r: number;
}

/** 字符串 → 0~1 确定性伪随机(布局抖动用,保证 SSR 一致) */
export function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h / 0xffffffff;
}

/** 权重 → 圆半径(16~46) */
export function nodeRadius(weight: number): number {
  return 16 + weight * 30;
}

/** 公域:origin 居中,其余按权重三同心环,环内均匀角分布 + 确定性抖动 */
export function concentricLayout(graph: PaperGraph): Map<string, PlacedNode> {
  const placed = new Map<string, PlacedNode>();
  placed.set(graph.origin.id, { x: CX, y: CY, r: 46 });

  const rings = [
    { min: 0.66, radius: 170, members: [] as PaperGraph["nodes"] },
    { min: 0.4, radius: 280, members: [] as PaperGraph["nodes"] },
    { min: 0, radius: 370, members: [] as PaperGraph["nodes"] },
  ];
  for (const node of graph.nodes) {
    (rings.find((ring) => node.weight > ring.min) ?? rings[2]).members.push(node);
  }

  for (const ring of rings) {
    ring.members.forEach((node, i) => {
      const angleJitter = (hash(node.id) - 0.5) * 0.42; // ±12°
      const angle =
        (i / ring.members.length) * Math.PI * 2 - Math.PI / 2 + angleJitter;
      const radius = ring.radius + (hash(node.id + ":r") - 0.5) * 36; // ±18px
      placed.set(node.id, {
        x: Math.round(CX + radius * Math.cos(angle)),
        y: Math.round(CY + radius * Math.sin(angle)),
        r: nodeRadius(node.weight),
      });
    });
  }
  return placed;
}

/** 私域:上下双层带(上=我的发表,下=收藏论文),层内权重越大越靠中轴 */
export function strataLayout(graph: PaperGraph): Map<string, PlacedNode> {
  const placed = new Map<string, PlacedNode>();
  const bands = [
    { layer: "mine" as const, y: 190 },
    { layer: "folder" as const, y: 570 },
  ];
  for (const band of bands) {
    const members = [graph.origin, ...graph.nodes]
      .filter((n) => n.layer === band.layer)
      .sort((a, b) => b.weight - a.weight);
    const spread = Math.min(160, 880 / Math.max(members.length - 1, 1));
    members.forEach((node, i) => {
      placed.set(node.id, {
        x: Math.round(CX + (i - (members.length - 1) / 2) * spread),
        y: Math.round(band.y + (hash(node.id + ":y") - 0.5) * 64), // ±32px
        r: nodeRadius(node.weight),
      });
    });
  }
  return placed;
}
```

- [ ] **Step 3: 类型检查**

Run: `cd frontend_v1 && pnpm exec tsc --noEmit`
Expected: 无错误(新文件尚未被引用,仅验证语法与类型)

---

### Task 2: Mock 数据

**Files:**
- Create: `lib/data/knowledge-graph.ts`

- [ ] **Step 1: 创建 `lib/data/knowledge-graph.ts`**(origin 摘要复用 paper-detail;14 公域节点 / 3 我的发表 + 9 收藏)

```ts
import type { PaperGraph } from "@/types";
import { paperDetail } from "./paper-detail";

/** 公域知识图谱 —— RDT-1B 引用关系宇宙(节点标签 = 一作姓 + 年份) */
export const publicGraph: PaperGraph = {
  origin: {
    id: "liu-2024",
    labelLines: ["Liu", "2024"],
    weight: 1,
    year: 2024,
    title: paperDetail.title,
    authors: "Songming Liu, Lingxuan Wu, Bangguo Li, et al.",
    venue: "arXiv",
    citations: "引用 312",
    abstract: paperDetail.abstract,
    paperId: "rdt-1b",
  },
  nodes: [
    {
      id: "chi-2023",
      labelLines: ["Chi", "2023"],
      weight: 0.95, year: 2023,
      title: "Diffusion Policy: Visuomotor Policy Learning via Action Diffusion",
      authors: "Cheng Chi, Siyuan Feng, Yilun Du, et al.",
      venue: "CoRL 2023", citations: "引用 1.8k",
      abstract:
        "We introduce Diffusion Policy, a new way of generating robot behavior by representing a robot's visuomotor policy as a conditional denoising diffusion process. Across 12 tasks from 4 benchmarks, Diffusion Policy outperforms existing state-of-the-art robot learning methods with an average improvement of 46.9%.",
    },
    {
      id: "kim-2024",
      labelLines: ["Kim", "2024"],
      weight: 0.8, year: 2024,
      title: "OpenVLA: An Open-Source Vision-Language-Action Model",
      authors: "Moo Jin Kim, Karl Pertsch, Siddharth Karamcheti, et al.",
      venue: "CoRL 2024", citations: "引用 890",
      abstract:
        "OpenVLA is a 7B-parameter open-source vision-language-action model trained on 970k robot demonstrations from the Open X-Embodiment dataset, achieving strong zero-shot generalization across embodiments and supporting efficient fine-tuning for new tasks.",
    },
    {
      id: "ze-2024",
      labelLines: ["Ze", "2024"],
      weight: 0.72, year: 2024,
      title: "3D Diffusion Policy: Generalizable Visuomotor Policy Learning via Simple 3D Representations",
      authors: "Yanjie Ze, Gu Zhang, Kangning Zhang, et al.",
      venue: "RSS 2024", citations: "引用 642",
      abstract:
        "DP3 incorporates 3D visual representations into diffusion policies, achieving strong performance with as few as 10 demonstrations and exhibiting robust generalization to unseen scenes, instances, and embodiments.",
    },
    {
      id: "black-2024",
      labelLines: ["Black", "2024"],
      weight: 0.7, year: 2024,
      title: "π0: A Vision-Language-Action Flow Model for General Robot Control",
      authors: "Kevin Black, Noah Brown, Danny Driess, et al.",
      venue: "arXiv 2024", citations: "引用 460",
      abstract:
        "We introduce π0, a flow-matching vision-language-action model that transfers internet-scale pretraining to dexterous robot control, enabling zero-shot folding, table bussing, and box packing across multiple robot platforms.",
    },
    {
      id: "ghosh-2024",
      labelLines: ["Ghosh", "2024"],
      weight: 0.68, year: 2024,
      title: "Octo: An Open-Source Generalist Robot Policy",
      authors: "Dibya Ghosh, Homer Walke, Karl Pertsch, et al.",
      venue: "RSS 2024", citations: "引用 520",
      abstract:
        "Octo is an open-source transformer-based generalist robot policy trained on 800k trajectories from Open X-Embodiment, supporting flexible task conditioning and efficient adaptation to new sensors and action spaces.",
    },
    {
      id: "khazatsky-2024",
      labelLines: ["Khazatsky", "2024"],
      weight: 0.65, year: 2024,
      title: "DROID: A Large-Scale In-the-Wild Robot Manipulation Dataset",
      authors: "Alexander Khazatsky, Karl Pertsch, Suraj Nair, et al.",
      venue: "ICRA 2024", citations: "引用 380",
      abstract:
        "DROID is a diverse robot manipulation dataset with 76k demonstration trajectories collected across 564 scenes and 86 tasks, designed to train policies that generalize to novel real-world environments.",
    },
    {
      id: "brohan-2023",
      labelLines: ["Brohan", "2023"],
      weight: 0.6, year: 2023,
      title: "RT-2: Vision-Language-Action Models Transfer Web Knowledge to Robotic Control",
      authors: "Anthony Brohan, Noah Brown, Justice Carbajal, et al.",
      venue: "CoRL 2023", citations: "引用 1.5k",
      abstract:
        "RT-2 co-fine-tunes vision-language models on web data and robot trajectories, producing vision-language-action policies that exhibit emergent semantic generalization to unseen objects and instructions.",
    },
    {
      id: "wen-2026",
      labelLines: ["Wen", "2026"],
      weight: 0.55, year: 2026,
      title: "DexMamba: 面向灵巧手控制的视觉状态空间扩散模型",
      authors: "Yuxuan Wen, Zhaohui Li, Manping Sun, et al.",
      venue: "arXiv 2026", citations: "引用 89",
      abstract:
        "DexMamba combines selective state-space backbones with diffusion action heads for dexterous hand control, achieving real-time 60Hz inference while preserving long-horizon temporal consistency.",
    },
    {
      id: "ho-2020",
      labelLines: ["Ho", "2020"],
      weight: 0.5, year: 2020,
      title: "Denoising Diffusion Probabilistic Models",
      authors: "Jonathan Ho, Ajay Jain, Pieter Abbeel",
      venue: "NeurIPS 2020", citations: "引用 12k",
      abstract:
        "We present high-quality image synthesis results using diffusion probabilistic models, a class of latent variable models inspired by non-equilibrium thermodynamics, achieving competitive log-likelihoods and FID scores.",
    },
    {
      id: "vaswani-2017",
      labelLines: ["Vaswani", "2017"],
      weight: 0.45, year: 2017,
      title: "Attention Is All You Need",
      authors: "Ashish Vaswani, Noam Shazeer, Niki Parmar, et al.",
      venue: "NeurIPS 2017", citations: "引用 128k",
      abstract:
        "We propose the Transformer, a network architecture based solely on attention mechanisms, dispensing with recurrence and convolutions entirely, achieving state-of-the-art translation quality with substantially less training time.",
    },
    {
      id: "fu-2024",
      labelLines: ["Fu", "2024"],
      weight: 0.42, year: 2024,
      title: "Mobile ALOHA: Learning Bimanual Mobile Manipulation with Low-Cost Whole-Body Teleoperation",
      authors: "Zipeng Fu, Tony Z. Zhao, Chelsea Finn",
      venue: "RSS 2024", citations: "引用 410",
      abstract:
        "Mobile ALOHA extends bimanual teleoperation to mobile manipulation with a low-cost whole-body interface, enabling imitation learning of complex long-horizon household tasks with high success rates.",
    },
    {
      id: "song-2021",
      labelLines: ["Song", "2021"],
      weight: 0.38, year: 2021,
      title: "Score-Based Generative Modeling through Stochastic Differential Equations",
      authors: "Yang Song, Jascha Sohl-Dickstein, Diederik P. Kingma, et al.",
      venue: "ICLR 2021", citations: "引用 6.4k",
      abstract:
        "We present a stochastic differential equation framework that unifies and generalizes score-based generative modeling and diffusion probabilistic models, enabling exact likelihood computation and controllable generation.",
    },
    {
      id: "zhao-2023",
      labelLines: ["Zhao", "2023"],
      weight: 0.35, year: 2023,
      title: "Learning Fine-Grained Bimanual Manipulation with Low-Cost Hardware",
      authors: "Tony Z. Zhao, Vikash Kumar, Sergey Levine, Chelsea Finn",
      venue: "RSS 2023", citations: "引用 690",
      abstract:
        "ALOHA is a low-cost bimanual teleoperation system; combined with Action Chunking with Transformers (ACT), it learns fine-grained tasks like threading zip ties from only 50 demonstrations.",
    },
    {
      id: "reed-2022",
      labelLines: ["Reed", "2022"],
      weight: 0.3, year: 2022,
      title: "A Generalist Agent",
      authors: "Scott Reed, Konrad Żołna, Emilio Parisotto, et al.",
      venue: "TMLR 2022", citations: "引用 2.1k",
      abstract:
        "Gato is a single generalist transformer trained on a wide variety of tasks — from Atari and robotics to image captioning and chat — demonstrating that a single model can sequence actions across modalities.",
    },
  ],
  edges: [
    { source: "liu-2024", target: "chi-2023", strength: 0.95 },
    { source: "liu-2024", target: "kim-2024", strength: 0.8 },
    { source: "liu-2024", target: "ze-2024", strength: 0.72 },
    { source: "liu-2024", target: "black-2024", strength: 0.7 },
    { source: "liu-2024", target: "ghosh-2024", strength: 0.68 },
    { source: "liu-2024", target: "khazatsky-2024", strength: 0.65 },
    { source: "liu-2024", target: "brohan-2023", strength: 0.6 },
    { source: "liu-2024", target: "wen-2026", strength: 0.55 },
    { source: "liu-2024", target: "ho-2020", strength: 0.5 },
    { source: "liu-2024", target: "vaswani-2017", strength: 0.45 },
    { source: "liu-2024", target: "fu-2024", strength: 0.42 },
    { source: "liu-2024", target: "song-2021", strength: 0.38 },
    { source: "liu-2024", target: "zhao-2023", strength: 0.35 },
    { source: "liu-2024", target: "reed-2022", strength: 0.3 },
    { source: "chi-2023", target: "ze-2024", strength: 0.8 },
    { source: "ho-2020", target: "song-2021", strength: 0.7 },
    { source: "zhao-2023", target: "fu-2024", strength: 0.85 },
    { source: "vaswani-2017", target: "brohan-2023", strength: 0.5 },
    { source: "kim-2024", target: "ghosh-2024", strength: 0.6 },
    { source: "black-2024", target: "chi-2023", strength: 0.55 },
  ],
  relatedIds: [
    "chi-2023", "kim-2024", "ze-2024", "black-2024", "ghosh-2024",
    "khazatsky-2024", "brohan-2023", "wen-2026", "ho-2020",
    "vaswani-2017", "fu-2024", "song-2021", "zhao-2023", "reed-2022",
  ],
};

/** 私域知识图谱 —— 我的发表 × 收藏论文 分层(节点标签 = 关键词 + 年份) */
export const privateGraph: PaperGraph = {
  origin: {
    id: "m1",
    labelLines: ["扩散策略", "2025"],
    weight: 0.9, year: 2025, layer: "mine",
    title: "Hierarchical Diffusion Policies for Contact-Rich Manipulation",
    authors: "陈知行, 王璐, 李慕白",
    venue: "ICRA 2026(under review)", citations: "预印本",
    abstract:
      "We propose a hierarchical diffusion policy that decouples contact-rich manipulation into a contact-planning diffusion head and a motion-execution transformer, improving success rates by 23% on insertion and deformable-object tasks while keeping 30Hz closed-loop control.",
  },
  nodes: [
    {
      id: "m2",
      labelLines: ["机器人基础模型", "2024"],
      weight: 0.72, year: 2024, layer: "mine",
      title: "Cross-Embodiment Pretraining for Robot Foundation Models",
      authors: "陈知行, 李慕白, 赵启明",
      venue: "arXiv 2024", citations: "引用 86",
      abstract:
        "A masked action-modeling pretraining objective that shares a single policy backbone across 6 robot embodiments, reducing per-embodiment fine-tuning data requirements by 4×.",
    },
    {
      id: "m3",
      labelLines: ["视觉伺服", "2022"],
      weight: 0.48, year: 2022, layer: "mine",
      title: "Visual Servoing via Learned Keypoint Affordances",
      authors: "陈知行, 吴桐",
      venue: "IROS 2022", citations: "引用 41",
      abstract:
        "We learn dense keypoint affordance fields from self-supervised interaction and use them as the visual feedback signal for closed-loop servoing of deformable and articulated objects.",
    },
    {
      id: "f7",
      labelLines: ["机器人学习", "2024"],
      weight: 0.85, year: 2024, layer: "folder",
      title: paperDetail.title,
      authors: "Songming Liu, Lingxuan Wu, Bangguo Li, et al.",
      venue: "arXiv 2024", citations: "引用 312",
      abstract: paperDetail.abstract,
      paperId: "rdt-1b",
    },
    {
      id: "f1",
      labelLines: ["扩散模型", "2025"],
      weight: 0.8, year: 2025, layer: "folder",
      title: "Diffusion Models for Iterative Video Frame Interpolation",
      authors: "Zhang Wei, Chen Li, Wang Ming",
      venue: "CVPR 2025", citations: "引用 96",
      abstract:
        "We formulate video frame interpolation as an iterative denoising process over motion-compensated latent frames, improving temporal consistency on fast-motion benchmarks.",
    },
    {
      id: "f3",
      labelLines: ["长上下文", "2025"],
      weight: 0.7, year: 2025, layer: "folder",
      title: "Long-Context Reasoning in Foundation Models",
      authors: "Wang Hao, Liu Yang, Zhou Tong",
      venue: "ICLR 2025", citations: "引用 54",
      abstract:
        "A hierarchical memory architecture enabling foundation models to reason over million-token contexts with linear compute growth, evaluated on LongBench v2 and RULER.",
    },
    {
      id: "f2",
      labelLines: ["智能体", "2024"],
      weight: 0.65, year: 2024, layer: "folder",
      title: "LLM Agents for Autonomous Scientific Discovery",
      authors: "Li Ming, Chen Hao, Liu Yu",
      venue: "NeurIPS 2024", citations: "引用 73",
      abstract:
        "We benchmark LLM agents on end-to-end scientific discovery loops — literature grounding, hypothesis generation, experiment planning, and result analysis — across 40 chemistry and biology tasks.",
    },
    {
      id: "f8",
      labelLines: ["世界模型", "2025"],
      weight: 0.6, year: 2025, layer: "folder",
      title: "World Models for Embodied Planning: A Survey",
      authors: "Sun Qi, Deng Rui, Fan Yu",
      venue: "TMLR 2025", citations: "引用 12",
      abstract:
        "A systematic survey of learned world models for embodied agents, comparing action-conditioned video prediction, latent dynamics, and their use in planning and policy learning.",
    },
    {
      id: "f4",
      labelLines: ["视频生成", "2025"],
      weight: 0.55, year: 2025, layer: "folder",
      title: "SANA-Video 2.0: Efficient Video Diffusion with Hybrid Linear Attention",
      authors: "Junsong Chen, Jincheng Yu, Yitong Li",
      venue: "arXiv 2026", citations: "引用 31",
      abstract:
        "Hybrid linear attention with periodic softmax anchoring cuts video diffusion training cost by 3.2× while preserving motion quality, generating 81-frame videos on a single H100 in 13.2s.",
    },
    {
      id: "f5",
      labelLines: ["Transformer", "2023"],
      weight: 0.5, year: 2023, layer: "folder",
      title: "Efficient Transformers for Long-Sequence Modeling: A Survey",
      authors: "Guo Liang, Shen Yao",
      venue: "ACM CSUR 2023", citations: "引用 210",
      abstract:
        "We taxonomize efficient transformer variants — sparse attention, low-rank kernels, recurrence, and memory compression — and benchmark them on sequences from 4k to 1M tokens.",
    },
    {
      id: "f6",
      labelLines: ["强化学习", "2024"],
      weight: 0.45, year: 2024, layer: "folder",
      title: "Offline RL Fine-tuning for Real-Robot Policy Adaptation",
      authors: "Han Xu, Qian Zhao",
      venue: "ICML 2024", citations: "引用 38",
      abstract:
        "A conservative offline RL recipe that adapts pretrained manipulation policies to hardware shifts using only 2k logged transitions, with no additional teleoperation.",
    },
    {
      id: "f9",
      labelLines: ["状态空间", "2024"],
      weight: 0.4, year: 2024, layer: "folder",
      title: "Mamba: Linear-Time Sequence Modeling with Selective State Spaces",
      authors: "Albert Gu, Tri Dao",
      venue: "COLM 2024", citations: "引用 1.2k",
      abstract:
        "Selective state-space models achieve linear-time sequence modeling with input-dependent dynamics, matching transformer quality at 5× higher inference throughput.",
    },
  ],
  edges: [
    { source: "m1", target: "m2", strength: 0.7 },
    { source: "m2", target: "m3", strength: 0.45 },
    { source: "f1", target: "f4", strength: 0.65 },
    { source: "f2", target: "f3", strength: 0.5 },
    { source: "f5", target: "f9", strength: 0.6 },
    { source: "f8", target: "f7", strength: 0.55 },
    { source: "m1", target: "f7", strength: 0.9, crossLayer: true },
    { source: "m1", target: "f1", strength: 0.6, crossLayer: true },
    { source: "m2", target: "f7", strength: 0.7, crossLayer: true },
    { source: "m2", target: "f8", strength: 0.5, crossLayer: true },
    { source: "m3", target: "f6", strength: 0.4, crossLayer: true },
  ],
  relatedIds: ["m2", "m3", "f7", "f1", "f3", "f2", "f8", "f4", "f5", "f6", "f9"],
};
```

- [ ] **Step 2: 类型检查**

Run: `cd frontend_v1 && pnpm exec tsc --noEmit`
Expected: 无错误

---

### Task 3: GraphCanvas(纯 SVG 画布)

**Files:**
- Create: `components/features/graph/graph-canvas.tsx`

- [ ] **Step 1: 创建组件**(SVG text 的 fill 用 Tailwind 4 的 `fill-*` 令牌工具类,与 `bg-*`/`text-*` 同源,日夜间自动适配)

```tsx
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { GraphNode, PaperGraph } from "@/types";
import { VIEW_H, VIEW_W, type PlacedNode } from "@/lib/graph-layout";

interface GraphCanvasProps {
  graph: PaperGraph;
  layout: Map<string, PlacedNode>;
  variant: "concentric" | "strata";
  selectedId: string;
  onSelect: (id: string) => void;
}

/** 私域层带标注位置(y 与 strataLayout 的带高对应) */
const BAND_META = [
  { layer: "mine" as const, text: "我的发表", y: 96 },
  { layer: "folder" as const, text: "收藏论文", y: 476 },
];

/** 知识图谱画布 —— 边 → 层带标注 → 节点 → 图例;点击空白回到 origin */
export function GraphCanvas({
  graph,
  layout,
  variant,
  selectedId,
  onSelect,
}: GraphCanvasProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const allNodes: GraphNode[] = [graph.origin, ...graph.nodes];
  const focusId = hoveredId ?? selectedId;

  const neighbors = new Set(
    graph.edges.flatMap((e) =>
      e.source === focusId ? [e.target] : e.target === focusId ? [e.source] : [],
    ),
  );

  const nodeFill = (node: GraphNode) =>
    variant === "strata" && node.layer === "folder"
      ? "var(--color-brand-cyan)"
      : "var(--color-primary)";

  return (
    <div>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="h-auto w-full select-none"
        role="img"
        aria-label="知识图谱"
        onClick={() => onSelect(graph.origin.id)}
      >
        {/* 边 */}
        {graph.edges.map((edge) => {
          const a = layout.get(edge.source);
          const b = layout.get(edge.target);
          if (!a || !b) return null;
          const active = edge.source === focusId || edge.target === focusId;
          return (
            <line
              key={`${edge.source}-${edge.target}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={active ? "var(--color-primary)" : "var(--color-line)"}
              strokeWidth={(1 + edge.strength * 1.5) * (active ? 1.4 : 1)}
              strokeDasharray={edge.crossLayer ? "5 4" : undefined}
              opacity={hoveredId && !active ? 0.25 : 0.9}
            />
          );
        })}

        {/* 私域:分层虚线 + 层带标注 */}
        {variant === "strata" && (
          <>
            <line
              x1={24}
              y1={VIEW_H / 2 - 40}
              x2={VIEW_W - 24}
              y2={VIEW_H / 2 - 40}
              stroke="var(--color-line)"
              strokeDasharray="3 6"
            />
            {BAND_META.map((band) => (
              <text
                key={band.layer}
                x={24}
                y={band.y}
                fontSize={13}
                letterSpacing={2}
                className="fill-faint"
              >
                {band.text} ·{" "}
                {allNodes.filter((n) => n.layer === band.layer).length}
              </text>
            ))}
          </>
        )}

        {/* 节点 */}
        {allNodes.map((node, i) => {
          const p = layout.get(node.id);
          if (!p) return null;
          const selected = node.id === selectedId;
          const dimmed =
            hoveredId !== null &&
            node.id !== focusId &&
            !neighbors.has(node.id);
          return (
            <motion.g
              key={node.id}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: dimmed ? 0.3 : 1, scale: 1 }}
              transition={{ delay: i * 0.04, duration: 0.35 }}
              style={{
                transformBox: "fill-box",
                transformOrigin: "center",
                cursor: "pointer",
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(node.id);
              }}
              onMouseEnter={() => setHoveredId(node.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <circle
                cx={p.x}
                cy={p.y}
                r={p.r}
                fill={nodeFill(node)}
                fillOpacity={selected ? 1 : 0.55 + node.weight * 0.45}
                stroke={
                  selected ? "var(--color-brand-violet)" : "var(--color-card)"
                }
                strokeWidth={selected ? 3 : 2}
              />
              <text
                x={p.x}
                y={p.y + p.r + 17}
                textAnchor="middle"
                fontSize={12}
                fontWeight={600}
                className="fill-ink-2"
              >
                {node.labelLines[0]}
              </text>
              <text
                x={p.x}
                y={p.y + p.r + 33}
                textAnchor="middle"
                fontSize={11}
                className="fill-faint"
              >
                {node.labelLines[1]}
              </text>
            </motion.g>
          );
        })}
      </svg>

      {/* 图例 */}
      <div className="mt-2 flex items-center justify-center gap-5 text-xs text-faint">
        {variant === "strata" ? (
          <>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-primary" />
              我的发表
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-brand-cyan" />
              收藏论文
            </span>
            <span>虚线 = 跨层关联</span>
          </>
        ) : (
          <span>圆圈大小 = 与原文关系强度</span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 类型检查**

Run: `cd frontend_v1 && pnpm exec tsc --noEmit`
Expected: 无错误

---

### Task 4: 左栏列表 + 右栏摘要卡

**Files:**
- Create: `components/features/graph/related-paper-list.tsx`
- Create: `components/features/graph/node-abstract-card.tsx`

- [ ] **Step 1: 创建 `related-paper-list.tsx`**

```tsx
"use client";

import type { PaperGraph } from "@/types";
import { cn } from "@/lib/utils";

interface RelatedPaperListProps {
  graph: PaperGraph;
  selectedId: string;
  onSelect: (id: string) => void;
}

/** 左栏 —— Origin paper 卡 + 关联论文列表(对应样页左栏) */
export function RelatedPaperList({
  graph,
  selectedId,
  onSelect,
}: RelatedPaperListProps) {
  const byId = new Map(
    [graph.origin, ...graph.nodes].map((n) => [n.id, n] as const),
  );
  const { origin } = graph;

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => onSelect(origin.id)}
        className={cn(
          "w-full rounded-xl border-l-2 border-primary bg-panel p-3 text-left transition-colors",
          selectedId === origin.id && "bg-primary-soft",
        )}
      >
        <p className="text-[11px] font-medium uppercase tracking-wide text-primary">
          Origin paper
        </p>
        <p className="mt-1 text-[13px] font-semibold leading-snug text-ink">
          {origin.title}
        </p>
        <p className="mt-1 text-xs text-faint">
          {origin.authors} · {origin.year}
        </p>
      </button>

      <ul className="space-y-1">
        {graph.relatedIds.map((id) => {
          const node = byId.get(id);
          if (!node) return null;
          const active = id === selectedId;
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onSelect(id)}
                className={cn(
                  "w-full rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-panel",
                  active && "bg-primary-soft hover:bg-primary-soft",
                )}
              >
                <p
                  className={cn(
                    "text-[13px] font-medium leading-snug",
                    active ? "text-primary" : "text-ink-2",
                  )}
                >
                  {node.title}
                </p>
                <p className="mt-0.5 text-[11px] text-faint">
                  {node.authors} · {node.year}
                </p>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: 创建 `node-abstract-card.tsx`**(服务端/客户端均可,无交互)

```tsx
import Link from "next/link";
import { ArrowRight, Quote } from "lucide-react";
import type { GraphNode } from "@/types";

/** 右栏 —— 选中节点论文的摘要卡(默认 origin) */
export function NodeAbstractCard({ node }: { node: GraphNode }) {
  return (
    <article className="space-y-3">
      <h2 className="text-[15px] font-bold leading-snug text-ink">
        {node.title}
      </h2>
      <p className="text-xs text-muted">{node.authors}</p>
      <p className="flex items-center gap-3 text-xs text-faint">
        <span>
          {node.venue} · {node.year}
        </span>
        <span className="flex items-center gap-1">
          <Quote className="size-3" />
          {node.citations}
        </span>
      </p>
      <p className="border-t border-line pt-3 text-[13px] leading-relaxed text-ink-2">
        {node.abstract}
      </p>
      {node.paperId && (
        <Link
          href={`/papers/${node.paperId}`}
          className="inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline"
        >
          查看论文详情
          <ArrowRight className="size-3.5" />
        </Link>
      )}
    </article>
  );
}
```

- [ ] **Step 3: 类型检查**

Run: `cd frontend_v1 && pnpm exec tsc --noEmit`
Expected: 无错误

---

### Task 5: GraphPageLayout(三栏骨架 + 选中状态)

**Files:**
- Create: `components/features/graph/graph-page-layout.tsx`

- [ ] **Step 1: 创建组件**(布局在客户端 useMemo 计算 —— 页面传入纯数据,避免 Map 跨 RSC 边界)

```tsx
"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { PaperGraph } from "@/types";
import { concentricLayout, strataLayout } from "@/lib/graph-layout";
import { GraphCanvas } from "./graph-canvas";
import { RelatedPaperList } from "./related-paper-list";
import { NodeAbstractCard } from "./node-abstract-card";

interface GraphPageLayoutProps {
  graph: PaperGraph;
  mode: "concentric" | "strata";
  backHref: string;
  backLabel: string;
  title: string;
  headerExtra?: ReactNode;
}

/** 知识图谱三栏骨架 —— 顶栏 / 左关联论文 / 中图谱 / 右摘要(小屏堆叠,图谱优先) */
export function GraphPageLayout({
  graph,
  mode,
  backHref,
  backLabel,
  title,
  headerExtra,
}: GraphPageLayoutProps) {
  const [selectedId, setSelectedId] = useState(graph.origin.id);
  const layout = useMemo(
    () => (mode === "concentric" ? concentricLayout(graph) : strataLayout(graph)),
    [graph, mode],
  );
  const selected =
    [graph.origin, ...graph.nodes].find((n) => n.id === selectedId) ??
    graph.origin;

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-card px-5">
        <Link
          href={backHref}
          className="flex shrink-0 items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-primary"
        >
          <ArrowLeft className="size-4" />
          {backLabel}
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-center text-[15px] font-semibold text-ink">
          {title}
        </h1>
        <div className="flex shrink-0 items-center">{headerExtra}</div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        <aside className="order-2 w-full shrink-0 border-line bg-card p-4 lg:order-1 lg:w-72 lg:overflow-y-auto lg:border-r">
          <RelatedPaperList
            graph={graph}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </aside>
        <main className="order-1 min-w-0 flex-1 p-6 lg:order-2 lg:overflow-y-auto">
          <GraphCanvas
            graph={graph}
            layout={layout}
            variant={mode}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </main>
        <aside className="order-3 w-full shrink-0 border-line bg-card p-5 lg:w-80 lg:overflow-y-auto lg:border-l">
          <NodeAbstractCard node={selected} />
        </aside>
      </div>
    </>
  );
}
```

- [ ] **Step 2: 类型检查**

Run: `cd frontend_v1 && pnpm exec tsc --noEmit`
Expected: 无错误

---

### Task 6: 公域图谱页 + Similar 面板入口

**Files:**
- Create: `app/papers/[id]/graph/page.tsx`
- Modify: `components/features/paper/right-panel.tsx`(import 行 + Similar TabsContent 末尾)

- [ ] **Step 1: 创建 `app/papers/[id]/graph/page.tsx`**(沉浸式,不用 AppShell;headerExtra 还原样页 Prior/Derivative 切换外观)

```tsx
import { GraphPageLayout } from "@/components/features/graph/graph-page-layout";
import { publicGraph } from "@/lib/data/knowledge-graph";
import { cn } from "@/lib/utils";

/** 公域知识图谱 `/papers/[id]/graph` —— 沉浸式(不使用全局侧边栏) */
export default async function PaperGraphPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="flex h-screen flex-col bg-background">
      <GraphPageLayout
        graph={publicGraph}
        mode="concentric"
        backHref={`/papers/${id}`}
        backLabel="返回阅读器"
        title={publicGraph.origin.title}
        headerExtra={
          <div className="flex rounded-lg border border-line text-[13px]">
            {["Prior works", "Derivative works"].map((label, i) => (
              <span
                key={label}
                className={cn(
                  "px-3 py-1.5",
                  i === 0
                    ? "rounded-l-[7px] bg-primary-soft font-medium text-primary"
                    : "rounded-r-[7px] text-faint",
                )}
              >
                {label}
              </span>
            ))}
          </div>
        }
      />
    </div>
  );
}
```

- [ ] **Step 2: `right-panel.tsx` 加入口** —— 修改两处:

(a) import 行(lucide-react 增加 Network):

```tsx
import { AtSign, Highlighter, Network, Plus, StickyNote } from "lucide-react";
```

(b) Similar TabsContent 内,`领域相关作者` 的 `</section>` 之后追加:

```tsx
          <section>
            <h3 className="border-b border-chip pb-2 text-[13px] font-semibold text-ink">
              知识图谱
            </h3>
            <Link
              href="/papers/rdt-1b/graph"
              className="mt-2.5 flex items-center gap-3 rounded-lg bg-panel p-3 transition-colors hover:bg-primary-soft"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft">
                <Network className="size-4.5 text-primary" />
              </span>
              <span>
                <span className="block text-xs font-medium text-ink-2">
                  公域引用关系图谱
                </span>
                <span className="mt-0.5 block text-[11px] text-faint">
                  14 篇关联论文 · 圆圈大小 = 关系强度 →
                </span>
              </span>
            </Link>
          </section>
```

- [ ] **Step 3: 类型检查 + 构建**

Run: `cd frontend_v1 && pnpm exec tsc --noEmit && pnpm exec next build --turbopack`
Expected: 无类型错误;构建路由表出现 `ƒ /papers/[id]/graph`

---

### Task 7: 私域图谱页 + 知识库入口

**Files:**
- Create: `app/knowledge/graph/page.tsx`
- Modify: `components/features/knowledge/library-panel.tsx`(import 行 + 标签区块之后)

- [ ] **Step 1: 创建 `app/knowledge/graph/page.tsx`**(AppShell 内;移动端扣掉 3.5rem 顶栏高度)

```tsx
import { AppShell } from "@/components/layout/app-shell";
import { GraphPageLayout } from "@/components/features/graph/graph-page-layout";
import { privateGraph } from "@/lib/data/knowledge-graph";

/** 私域知识图谱 `/knowledge/graph` —— 我的发表 × 收藏论文 分层双色图 */
export default function KnowledgeGraphPage() {
  return (
    <AppShell>
      <div className="flex h-[calc(100dvh-3.5rem)] flex-col bg-background lg:h-screen">
        <GraphPageLayout
          graph={privateGraph}
          mode="strata"
          backHref="/knowledge"
          backLabel="返回知识库"
          title="私域知识图谱"
        />
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 2: `library-panel.tsx` 加入口** —— 修改两处:

(a) 文件顶部新增 import(保留现有 Square):

```tsx
import Link from "next/link";
import { Network, Square } from "lucide-react";
```

(b) 标签区块(`</div>` 结束 tags 的 flex 容器)之后、`</aside>` 之前追加:

```tsx
      <p className="mt-5 px-1 text-xs text-faint">知识图谱</p>
      <Link
        href="/knowledge/graph"
        className="mt-2 flex items-center gap-2.5 rounded-lg bg-panel p-2.5 transition-colors hover:bg-primary-soft"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary-soft">
          <Network className="size-4 text-primary" />
        </span>
        <span>
          <span className="block text-[13px] font-medium text-ink-2">
            私域知识图谱
          </span>
          <span className="text-[11px] text-faint">
            我的发表 × 收藏论文 · 分层视图 →
          </span>
        </span>
      </Link>
```

- [ ] **Step 3: 类型检查 + 构建**

Run: `cd frontend_v1 && pnpm exec tsc --noEmit && pnpm exec next build --turbopack`
Expected: 无类型错误;构建路由表出现 `○ /knowledge/graph`

---

### Task 8: 整体验证 + 文档同步

**Files:**
- Create: `shot_graph.py`
- Modify: `README.md`(路由表 + 目录结构两处)

- [ ] **Step 1: 创建 `shot_graph.py`**(参照 shot_themes.py;生产服务器需先启动:`pnpm exec next start -p 3100`)

```python
# -*- coding: utf-8 -*-
"""知识图谱页日/夜截图"""
import subprocess, os, sys, io, time
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
edge = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
tmp = os.environ['TEMP']
base = 'http://localhost:3100'
shots = [
    ('/papers/rdt-1b/graph?theme=light', 'graph-public-day.png'),
    ('/papers/rdt-1b/graph?theme=dark', 'graph-public-night.png'),
    ('/knowledge/graph?theme=light', 'graph-private-day.png'),
    ('/knowledge/graph?theme=dark', 'graph-private-night.png'),
]
for path, out in shots:
    r = subprocess.run([edge, '--headless', '--disable-gpu', '--window-size=1440,1500',
                        '--hide-scrollbars', '--virtual-time-budget=8000',
                        '--screenshot=' + os.path.join(tmp, out), base + path],
                       capture_output=True, text=True)
    lines = (r.stderr or '').strip().splitlines()
    print(out, lines[-1] if lines else 'ok')
    time.sleep(1)
```

- [ ] **Step 2: 构建 + 启动生产服务器**

Run: `cd frontend_v1 && pnpm exec next build --turbopack && (pnpm exec next start -p 3100 &)`
Expected: 构建通过;`curl -s -o /dev/null -w "%{http_code}" http://localhost:3100/knowledge/graph` 返回 200

- [ ] **Step 3: SSR 内容验证**(动画伪影豁免 —— 节点标签必须在 SSR HTML 中)

Run: `curl -s http://localhost:3100/papers/rdt-1b/graph | grep -o "Diffusion Policy: Visuomotor" | head -1 && curl -s http://localhost:3100/knowledge/graph | grep -o "扩散策略" | head -1`
Expected: 各输出 1 行匹配

- [ ] **Step 4: 截图日/夜四张并目检**

Run: `cd frontend_v1 && python shot_graph.py && cp "$TEMP"/graph-*.png ../brand/`
Expected: 4 张 PNG 写入 `brand/`;目检:公域同心环 + 紫圈选中、私域上下双层双色 + 跨层虚线、夜间令牌正确反色

- [ ] **Step 5: 停服务器**

Run: `PID=$(netstat -ano | grep ':3100' | grep LISTENING | awk '{print $NF}' | head -1) && taskkill //PID $PID //F`

- [ ] **Step 6: 更新 `README.md`** —— 两处:

(a) 路由表「`/knowledge`」行之后插入两行:

```markdown
| `/papers/[id]/graph` | 公域知识图谱(引用关系三栏页) | 知识图谱样页.png | [app/papers/[id]/graph/page.tsx](app/papers/[id]/graph/page.tsx) |
| `/knowledge/graph` | 私域知识图谱(发表×收藏分层) | 知识图谱样页.png | [app/knowledge/graph/page.tsx](app/knowledge/graph/page.tsx) |
```

(b) 目录结构块中 `components/features/` 行的注释改为 `search / submit / paper / scholar / knowledge / agent / graph`,并在 `lib/` 下补一行 `│   ├── graph-layout.ts           # 图谱确定性布局(同心环 / 双层带)`。

---

## Self-Review 记录

- **规范覆盖**:路由/入口(§二 → Task 6/7)、数据(§三 → Task 1/2,`label` 字段合并为 `labelLines` 已注明)、视觉(§四 → Task 1/3)、三栏交互(§五 → Task 4/5)、文件清单(§六 → Task 1-7)、边界(§七 → paperId 缺失不渲染链接在 Task 4 实现;小屏堆叠在 Task 5 实现)、验证(§八 → Task 8)。
- **类型一致性**:`GraphNode.labelLines` / `weight` / `layer`、`GraphEdge.crossLayer`、`PlacedNode`、`concentricLayout`/`strataLayout` 在各 Task 间拼写一致;`GraphCanvas.variant` 与 `GraphPageLayout.mode` 取值同为 `"concentric" | "strata"`。
- **占位符扫描**:无 TBD/TODO;所有步骤含完整代码或确切命令。
