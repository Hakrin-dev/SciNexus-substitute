/** 知识库·AI 记忆 mock —— 助手关于用户的长期记忆条目(演示) */

export type MemoryScope = "global" | "project";

export interface MemoryEntry {
  id: string;
  /** 记忆的事实陈述(AI 视角第一人称) */
  fact: string;
  /** 来源会话标题 */
  source: string;
  createdAt: string;
  /** 作用域:global=全局生效;project=仅指定项目内生效 */
  scope: MemoryScope;
  /** scope=project 时的项目名 */
  project?: string;
}

export const memoryMock: MemoryEntry[] = [
  {
    id: "m1",
    fact: "用户的研究方向是机器人操作中的扩散策略,当前聚焦推理效率优化。",
    source: "长上下文 Transformer 调研",
    createdAt: "2026-08-10T10:00:00+08:00",
    scope: "global",
  },
  {
    id: "m2",
    fact: "用户偏好的论文呈现格式:先结论后论据,引用保留「编号. 标题(作者, 年份)」样式。",
    source: "NeurIPS 2026 投稿筛选",
    createdAt: "2026-08-14T14:20:00+08:00",
    scope: "global",
  },
  {
    id: "m3",
    fact: "用户正在准备 NeurIPS 2026 投稿,deadline 相关提醒应提高优先级。",
    source: "NeurIPS 2026 投稿筛选",
    createdAt: "2026-08-16T09:05:00+08:00",
    scope: "global",
  },
  {
    id: "m4",
    fact: "实验环境为单卡 RTX 4090,推荐方案时需考虑 24GB 显存约束。",
    source: "扩散模型效率优化",
    createdAt: "2026-08-19T16:40:00+08:00",
    scope: "project",
    project: "研枢",
  },
  {
    id: "m5",
    fact: "综述管线的实验数据统一放在 wb_assets 的 a2 数据集,引用时用版本号 v2。",
    source: "扩散模型效率优化",
    createdAt: "2026-08-20T13:10:00+08:00",
    scope: "project",
    project: "研枢",
  },
  {
    id: "m6",
    fact: "用户习惯用中文提问但希望术语保留英文原文。",
    source: "操作泛化性研究计划",
    createdAt: "2026-08-21T11:30:00+08:00",
    scope: "global",
  },
];
