/** 知识库·笔记 mock —— 前端演示态初始数据(stores/demo-state 注入) */

export interface NoteItem {
  id: string;
  title: string;
  /** 纯文本摘要(编辑器为多行纯文本) */
  content: string;
  tags: string[];
  /** 关联论文 id(可空) */
  paperId?: string;
  paperTitle?: string;
  updatedAt: string;
}

export const notesMock: NoteItem[] = [
  {
    id: "n1",
    title: "综述管线的两条正确性指标",
    content:
      "读 review.py 三阶段管线后的归纳:\n1. 引用真实性 —— 输出引用必须一一对应检索阶段 ref_id 集合,resolve_citations 重编号 + 悬空剔除;\n2. 论断不丢失 —— 全分划聚类保证每条论断必属且仅属一个维度。\n后续实验设计都围绕这两个指标展开。",
    tags: ["综述管线", "正确性"],
    paperId: "rdt-1b",
    paperTitle: "RDT-1B: a Diffusion Foundation Model for Bimanual Manipulation",
    updatedAt: "2026-08-22T10:00:00+08:00",
  },
  {
    id: "n2",
    title: "扩散策略 vs VLA 选型对比",
    content:
      "扩散策略:动作空间生成,推理延迟敏感但可控性好;\nVLA:语言条件泛化强,算力要求高。\n机器人操控场景优先 diffusion policy,VLA 适合开放指令任务。",
    tags: ["选型", "机器人"],
    paperId: "",
    updatedAt: "2026-08-20T15:30:00+08:00",
  },
  {
    id: "n3",
    title: "跨章节引用编号漂移的修复思路",
    content:
      "失败用例归因:长文档中 [12] 被重编号后正文未同步。\n候选方案:\na) 全局编号池(编译期分配);\nb) 两遍渲染:先收集再回填。\n倾向 b,改动面小。",
    tags: ["引用对齐", "修复思路"],
    updatedAt: "2026-08-18T09:10:00+08:00",
  },
  {
    id: "n4",
    title: "NeurIPS 2026 rebuttal 要点清单",
    content:
      "审稿人 2 关注聚类漏归场景。准备材料:\n- 补聚回归实验数据 v2(48MB 数据集)\n- 分划不变式形式化描述\n- 反例边界说明。",
    tags: ["投稿", "rebuttal"],
    updatedAt: "2026-08-15T20:00:00+08:00",
  },
  {
    id: "n5",
    title: "结构化输出 schema 设计原则",
    content:
      "给 LLM 的 JSON schema:\n1. 字段名用领域词汇而非通用 value/data;\n2. 枚举值前置约束;\n3. 必填字段 ≤5 个,可选字段给 default。\n违反这三条的输出解析失败率明显更高。",
    tags: ["prompt", "方法论"],
    updatedAt: "2026-08-12T11:00:00+08:00",
  },
];
