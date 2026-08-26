import type { AgentReference } from "@/types";

export const agentReferences: AgentReference[] = [
  {
    id: 1,
    venue: "CoRL 2024 · Stanford",
    title: "Diffusion Policy: Visuomotor Policy Learning via Action Diffusion",
    author: "Chi et al.",
    citations: "引用 1.8k",
    tone: "violet",
  },
  {
    id: 2,
    venue: "RSS 2025 · MIT",
    title: "3D Diffusion Policy: Generalizable Visuomotor Policy Learning via Sparse 3D Representation",
    author: "Ze et al.",
    citations: "引用 642",
    tone: "green",
  },
  {
    id: 3,
    venue: "ICML 2026 · 推荐",
    title: "RDT-1B: A Diffusion Foundation Model for Robotic Manipulation",
    author: "Liu et al.",
    citations: "引用 312",
    tone: "amber",
    recommended: true,
  },
  {
    id: 4,
    venue: "arXiv 2026 · NVIDIA",
    title: "DexMamba: 面向灵巧手控制的视觉状态空间扩散模型",
    author: "Wen et al.",
    citations: "引用 89",
    tone: "gray",
  },
];

