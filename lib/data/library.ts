import type { LibraryFolder, LibraryItem, LibraryTag } from "@/types";

/** 知识库文件夹 —— 内容提取自「深知-知识库页面.svg」
 *  color 用于侧边栏方块样式(PaperSubNav)和原 LibraryPanel 保持一致的视觉编码。
 */
export const libraryFolders: LibraryFolder[] = [
  { name: "我的发表", count: 3, color: "#F4A261" },
  { name: "想读", count: 8, color: "#94A3B8" },
  { name: "在读", count: 12, active: true, color: "#F97316" },
  { name: "已读", count: 47, color: "#22C55E" },
  { name: "归档", count: 23, color: "#A78BFA" },
];

/** 标签色彩顺序与原 LibraryPanel TAG_COLORS 一一对应：
 *  主色 / 蓝 / 绿 / 红 / 紫
 */
export const libraryTags: LibraryTag[] = [
  { name: "扩散模型", color: "#F97316" },
  { name: "Transformer", color: "#3B82F6" },
  { name: "智能体", color: "#16A34A" },
  { name: "视频生成", color: "#DC2626" },
  { name: "长上下文", color: "#7C3AED" },
];

/** 文件夹默认兜底映射：原 table 标题是「在读」,这里把 3 条样例全部放入「在读」，
 *  同时给每条打不同的 tag，让标签筛选在页面中能看到真实效果。
 *  其他文件夹（已读/想读/归档/我的发表）在 UI 中仍会显示各自数量，命中时返回对应空结果。
 */
const MOCK_ITEMS: LibraryItem[] = [
  {
    id: "lib-1",
    title: "Diffusion Models for Iterative Video Frame Interpolation",
    venue: "CVPR 2025",
    arxiv: "arXiv:2406.12345",
    authors: "Zhang Wei, Chen Li, Wang Ming",
    addedAt: "7月25日",
    pdfTone: "violet",
    folder: "在读",
    tags: ["扩散模型", "视频生成"],
  },
  {
    id: "lib-2",
    title: "LLM Agents for Autonomous Scientific Discovery",
    venue: "NeurIPS 2024",
    arxiv: "arXiv:2411.08901",
    authors: "Li Ming, Chen Hao, Liu Yu",
    addedAt: "7月22日",
    pdfTone: "amber",
    folder: "在读",
    tags: ["智能体", "Transformer"],
  },
  {
    id: "lib-3",
    title: "Long-Context Reasoning in Foundation Models",
    venue: "ICLR 2025",
    arxiv: "arXiv:2501.04567",
    authors: "Wang Hao, Liu Yang, Zhou Tong",
    addedAt: "7月18日",
    pdfTone: "green",
    folder: "在读",
    tags: ["长上下文", "Transformer"],
  },
];

export const libraryItems: LibraryItem[] = MOCK_ITEMS;

