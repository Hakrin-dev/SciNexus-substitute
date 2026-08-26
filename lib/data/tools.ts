/** 工具库 mock —— 技能 / 插件 / MCP 服务器(前端演示) */

/* ── 技能 ───────────────────────────────────────────────────── */

export interface SkillItem {
  id: string;
  name: string;
  description: string;
  category: "检索" | "写作" | "分析" | "代码";
  version: string;
}

export const skillsMock: SkillItem[] = [
  { id: "sk-deep-search", name: "深度检索", description: "多路召回 + 相关度精排,自动整理参考文献清单", category: "检索", version: "1.4.0" },
  { id: "sk-cite-guard", name: "引用守卫", description: "生成阶段校验 [N] 编号与来源一一对应,杜绝幽灵引用", category: "写作", version: "1.1.2" },
  { id: "sk-survey-weave", name: "综述织网", description: "论断提取→聚类→成文三阶段,产出带全局编号的文献综述", category: "写作", version: "2.0.0" },
  { id: "sk-table-read", name: "表格精读", description: "从论文 PDF 中抽取对比表并对齐行含义", category: "分析", version: "0.9.3" },
  { id: "sk-exp-design", name: "实验设计助手", description: "根据假设生成可执行的实验步骤与评估指标", category: "代码", version: "1.0.5" },
  { id: "sk-code-replay", name: "算法复现", description: "阅读论文方法章节,输出可运行的 PyTorch 骨架代码", category: "代码", version: "1.2.0" },
  { id: "sk-trend-scan", name: "趋势扫描", description: "按方向聚合近 90 天新论文,输出趋势要点", category: "检索", version: "1.0.0" },
  { id: "sk-claim-map", name: "论断地图", description: "跨论文对齐同一论断的支持/反驳证据", category: "分析", version: "0.8.1" },
];

export const SKILL_CATEGORIES = ["全部", "检索", "写作", "分析", "代码"] as const;

/* ── 插件 ───────────────────────────────────────────────────── */

export interface PluginItem {
  id: string;
  name: string;
  description: string;
  author: string;
  installs: string;
  installed: boolean;
}

export const pluginsMock: PluginItem[] = [
  { id: "pg-arxiv-sync", name: "arXiv 同步", description: "订阅关键词,每日新论文自动入库知识库", author: "研枢官方", installs: "12.8k", installed: true },
  { id: "pg-latex-export", name: "LaTeX 导出", description: "把回答中的公式与参考文献一键导出为 .tex", author: "研枢官方", installs: "9.3k", installed: true },
  { id: "pg-zotero", name: "Zotero 连接器", description: "双向同步文献库与 Zotero 条目", author: "社区", installs: "6.1k", installed: false },
  { id: "pg-overleaf", name: "Overleaf 协作", description: "将综述草稿推送到 Overleaf 项目", author: "社区", installs: "4.7k", installed: false },
  { id: "pg-semantic-map", name: "语义地图", description: "以知识图谱方式可视化论文间引用关系", author: "社区", installs: "3.9k", installed: false },
  { id: "pg-deadline-radar", name: "Deadline 雷达", description: "跟踪目标会议的摘要/全文截止并生成提醒", author: "研枢官方", installs: "11.2k", installed: true },
  { id: "pg-rebuttal-draft", name: "Rebuttal 起草", description: "针对审稿意见逐条起草回复框架", author: "社区", installs: "2.6k", installed: false },
  { id: "pg-data-viz", name: "数据速览", description: "对话中直接渲染 CSV/JSON 的统计图表", author: "社区", installs: "5.4k", installed: false },
];

/* ── MCP 服务器 ──────────────────────────────────────────────── */

export interface McpServer {
  id: string;
  name: string;
  /** 启动命令或 endpoint 描述 */
  command: string;
  /** 工具数量 */
  tools: number;
  connected: boolean;
  envKeys: string[];
  /** 配置 JSON 展示用 */
  configJson: string;
}

export const mcpServersMock: McpServer[] = [
  {
    id: "mcp-openalex",
    name: "OpenAlex 文献",
    command: "npx -y mcp-openalex",
    tools: 6,
    connected: true,
    envKeys: ["OPENALEX_MAILTO"],
    configJson: `{\n  "mcpServers": {\n    "openalex": {\n      "command": "npx",\n      "args": ["-y", "mcp-openalex"],\n      "env": { "OPENALEX_MAILTO": "***" }\n    }\n  }\n}`,
  },
  {
    id: "mcp-fs",
    name: "本地文件系统",
    command: "npx -y @modelcontextprotocol/server-filesystem ~/papers",
    tools: 4,
    connected: true,
    envKeys: [],
    configJson: `{\n  "mcpServers": {\n    "filesystem": {\n      "command": "npx",\n      "args": ["-y", "@modelcontextprotocol/server-filesystem", "~/papers"]\n    }\n  }\n}`,
  },
  {
    id: "mcp-gpu-runner",
    name: "GPU 实验执行器",
    command: "uvx gpu-runner-mcp --pool lab-a100",
    tools: 3,
    connected: false,
    envKeys: ["RUNNER_TOKEN"],
    configJson: `{\n  "mcpServers": {\n    "gpu-runner": {\n      "command": "uvx",\n      "args": ["gpu-runner-mcp", "--pool", "lab-a100"],\n      "env": { "RUNNER_TOKEN": "***" }\n    }\n  }\n}`,
  },
];

/* ── 社区技能 ────────────────────────────────────────────────── */

export interface CommunitySkill {
  id: string;
  name: string;
  description: string;
  author: string;
  installs: string;
  /** 系统推荐(社区 tab 置顶展示) */
  featured?: boolean;
}

export const communitySkillsMock: CommunitySkill[] = [
  { id: "cs-paper2slide", name: "论文转幻灯", description: "按 Beamer 风格把方法章节转成汇报页大纲", author: "Mila-Lab", installs: "8.2k", featured: true },
  { id: "cs-bench-hunt", name: "基准猎手", description: "为给定方法自动匹配最合适的公开基准与 SOTA 对比", author: "sysml-cn", installs: "5.6k", featured: true },
  { id: "cs-related-matrix", name: "相关工作矩阵", description: "把 20+ 篇相关工作整理成「方法×贡献」对照表", author: "paper-reading", installs: "4.9k" },
  { id: "cs-fig-redraw", name: "示意图重绘", description: "把论文截图描述转绘为可编辑的 TikZ 草稿", author: "texcraft", installs: "3.1k" },
  { id: "cs-review-drill", name: "审稿演练", description: "模拟三位审稿人视角对草稿提问并给出修改建议", author: "peer-lab", installs: "2.8k", featured: true },
  { id: "cs-dataset-card", name: "数据集卡片", description: "按 Datasheets for Datasets 规范生成数据集说明", author: "open-data-cn", installs: "1.9k" },
];

/** 自定义技能(含 skill.md 内容) */
export interface CustomSkill {
  id: string;
  name: string;
  description: string;
  category: "检索" | "写作" | "分析" | "代码";
  version: string;
  contentMd: string;
  /** 已发布到社区(演示:仅打标记) */
  published?: boolean;
  /** 从 GitHub 导入的仓库地址 */
  fromGithub?: string;
}

export const SKILL_MD_TEMPLATE = (name: string, description: string, category: string) =>
  `---
name: ${name || "未命名技能"}
description: ${description || "一句话描述这个技能做什么、什么时候触发"}
category: ${category}
version: 1.0.0
---

# 触发时机
- 用户提出什么样的请求时应该使用本技能?

# 执行步骤
1. 第一步(做什么)
2. 第二步
3. 输出格式约定

# 约束
- 严禁编造引用;引用必须来自检索结果
- 输出使用中文,术语保留英文
`;
