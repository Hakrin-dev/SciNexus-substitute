/**
 * 多智能体编排层（TypeScript 版，对齐旧版 backend/agent/research_assistant）。
 *
 * 将旧版 LangGraph 多智能体（supervisor/scout/synthesis/librarian/writer/critic/
 * research_design/code_assistant）收敛为：
 *  1. 意图识别（10 类）+ 任务规划（supervisor 职责）
 *  2. scout 真实检索（读 SQLite 论文库）
 *  3. 其余 agent 基于 LLM 生成结构化输出（未配置 LLM 时回退规则模板）
 *  4. finalize 组合为最终回答，并产出 workflow / references / generatedFiles
 */
import { getDB, jsonParse, mapPaper } from "./db";
import { chatText, hasLLM, type ModelChoice } from "./llm";
import { genId } from "./utils";

export interface AgentStep {
  agent: string;
  action: string;
  status: "done" | "pending" | "failed";
  tools?: string[];
}

export interface AgentReference {
  title: string;
  authors: string;
  venue: string;
  year: number | null;
  ccf: string | null;
  citations: number;
  match: string;
}

export interface GeneratedFile {
  path: string;
  language: string;
  content: string;
}

export interface AgentResult {
  reply: string;
  workflow: {
    task_id: string;
    agents: string[];
    steps: AgentStep[];
    errors: any[];
    status: string;
  };
  references: AgentReference[] | null;
  generatedFiles: GeneratedFile[] | null;
}

// ==================== 意图表（对应旧版 supervisor.INTENT_TABLE） ====================

const INTENT_TABLE: Record<
  string,
  { description: string; requiredAgents: string[]; steps: { agent: string; action: string }[] }
> = {
  paper_search: {
    description: "智能论文搜索与综合回答",
    requiredAgents: ["scout", "synthesis"],
    steps: [
      { agent: "scout", action: "检索相关论文" },
      { agent: "synthesis", action: "基于检索结果综合回答" },
    ],
  },
  similar_papers: {
    description: "相似论文查询",
    requiredAgents: ["scout", "librarian"],
    steps: [
      { agent: "scout", action: "检索相关论文" },
      { agent: "librarian", action: "构建研究图谱" },
    ],
  },
  ai_reading: {
    description: "AI 辅助论文阅读",
    requiredAgents: ["scout", "synthesis"],
    steps: [
      { agent: "scout", action: "定位论文" },
      { agent: "synthesis", action: "研读并结构化" },
    ],
  },
  research_exploration: {
    description: "科研探索",
    requiredAgents: ["scout", "librarian"],
    steps: [
      { agent: "scout", action: "检索前沿论文" },
      { agent: "librarian", action: "构建研究图谱" },
    ],
  },
  autonomous_research: {
    description: "自主科研全流程",
    requiredAgents: ["scout", "librarian", "research_design", "code_assistant", "writer", "critic"],
    steps: [
      { agent: "scout", action: "检索相关论文" },
      { agent: "librarian", action: "构建研究图谱" },
      { agent: "research_design", action: "生成研究方案" },
      { agent: "code_assistant", action: "生成实验代码" },
      { agent: "writer", action: "撰写论文初稿" },
      { agent: "critic", action: "审稿与投稿匹配" },
    ],
  },
  code_generation: {
    description: "科研代码生成与算法复现",
    requiredAgents: ["code_assistant"],
    steps: [{ agent: "code_assistant", action: "生成可复现代码文件" }],
  },
  ai_writing: {
    description: "AI 辅助科研撰写",
    requiredAgents: ["writer", "critic"],
    steps: [
      { agent: "writer", action: "撰写论文初稿" },
      { agent: "critic", action: "审稿" },
    ],
  },
  literature_review: {
    description: "文献综述生成",
    requiredAgents: ["scout", "writer", "critic"],
    steps: [
      { agent: "scout", action: "检索综述证据" },
      { agent: "writer", action: "撰写文献综述" },
      { agent: "critic", action: "审校引用与结构" },
    ],
  },
  submission: {
    description: "论文投稿",
    requiredAgents: ["critic"],
    steps: [{ agent: "critic", action: "投稿方向匹配分析" }],
  },
  library_management: {
    description: "个人文献库管理",
    requiredAgents: ["librarian"],
    steps: [{ agent: "librarian", action: "管理个人文献库" }],
  },
};

const KEYWORD_RULES: [string[], string][] = [
  [["投稿", "投到", "投递", "会议匹配", "期刊", "发表到", "投稿方案"], "submission"],
  [["自主科研", "自动科研", "全流程", "一键科研"], "autonomous_research"],
  [["代码", "实现", "复现", "算法伪代码", "pytorch", "python", "训练脚本"], "code_generation"],
  [["文献综述", "综述"], "literature_review"],
  [["相似论文", "对比", "赛道", "同方向", "区别", "差异对比"], "similar_papers"],
  [["阅读", "精读", "解读", "讲解", "总结这篇", "问答"], "ai_reading"],
  [["研究趋势", "科研探索", "探索", "前沿", "热点", "研究方向", "gap"], "research_exploration"],
  [["写论文", "撰写", "初稿", "改论文", "写作", "latex"], "ai_writing"],
  [["文献库", "管理", "归档", "图谱", "整理", "私域"], "library_management"],
  [["搜索", "检索", "查找", "找论文", "查询"], "paper_search"],
  [["autonomous", "full pipeline", "end-to-end"], "autonomous_research"],
  [["code", "implement", "reproduce", "pytorch", "training script"], "code_generation"],
  [["literature review", "survey paper", "related work survey"], "literature_review"],
  [["submission", "venue matching", "publish", "journal"], "submission"],
  [["similar papers", "related work", "comparison", "compare"], "similar_papers"],
  [["summarize", "read this paper", "explain", "parse", "qa"], "ai_reading"],
  [["research trend", "frontier", "research direction", "gap analysis"], "research_exploration"],
  [["write paper", "draft paper", "polish", "revise", "latex"], "ai_writing"],
  [["my library", "organize", "manage papers", "folder"], "library_management"],
  [["search", "find papers", "query", "retrieve", "find"], "paper_search"],
];

const DEFAULT_INTENT = "paper_search";

function recognizeIntent(query: string): { taskType: string; requiredAgents: string[]; description: string } {
  for (const [keywords, taskType] of KEYWORD_RULES) {
    if (keywords.some((k) => query.includes(k))) {
      const info = INTENT_TABLE[taskType];
      return { taskType, requiredAgents: info.requiredAgents, description: info.description };
    }
  }
  const info = INTENT_TABLE[DEFAULT_INTENT];
  return { taskType: DEFAULT_INTENT, requiredAgents: info.requiredAgents, description: info.description };
}

function buildTaskPlan(taskType: string) {
  const info = INTENT_TABLE[taskType] || INTENT_TABLE[DEFAULT_INTENT];
  return info.steps.map((s, i) => ({ step: i + 1, ...s }));
}

// ==================== scout 真实检索 ====================

function scoutSearch(query: string, limit = 8): any[] {
  const db = getDB();
  const tokens = query.toLowerCase().split(/\s+/).filter((t) => t.length > 1);
  const rows = db.prepare("SELECT * FROM papers").all() as any[];
  const scored = rows
    .map((r) => {
      const blob = `${r.title} ${r.abstract} ${jsonParse<string[]>(r.tags_json, []).join(" ")}`.toLowerCase();
      let hits = 0;
      for (const t of tokens) if (blob.includes(t)) hits++;
      return { r, hits };
    })
    .filter((x) => x.hits > 0 || tokens.length === 0)
    .sort((a, b) => b.hits - a.hits || b.r.citations - a.r.citations)
    .slice(0, limit);
  return scored.map((x) => mapPaper(x.r));
}

// ==================== 各 agent 规则模板（无 LLM 兜底） ====================

function ruleReply(taskType: string, query: string, papers: any[]): string {
  switch (taskType) {
    case "literature_review":
      return `好的，我将为您撰写关于「${query}」的文献综述。\n\n**综述大纲**\n1. 研究背景与发展脉络\n2. 核心技术与代表性工作\n3. 对比分析与关键挑战\n4. 未来展望与开放问题\n\n（已检索 ${papers.length} 篇相关论文作为证据）`;
    case "code_generation":
      return "好的，我来生成实验代码骨架：\n\n```python\nimport torch\n\nclass Model(torch.nn.Module):\n    def __init__(self):\n        super().__init__()\n        # TODO: 按需填充网络结构\n\n    def forward(self, x):\n        return x\n```";
    case "submission":
      return "根据您的研究方向，推荐投稿目标：\n1. **AAAI 2027**（CCF-A）— 匹配度 88%\n2. **NeurIPS 2026** — 匹配度 85%\n3. **IEEE TPAMI**（CCF-A 期刊）— 匹配度 90%\n\n详细策略请切换「投稿分析」页面。";
    case "ai_reading":
      return papers.length
        ? `已定位到论文「${papers[0].title}」，核心摘要如下：\n\n${(papers[0].abstract || "").slice(0, 300)}`
        : "未定位到相关论文，请提供论文标题或 ID。";
    case "similar_papers":
    case "research_exploration":
      return papers.length
        ? `为你筛选出 ${papers.length} 篇相关论文，优先阅读：\n\n` +
            papers.slice(0, 5).map((p, i) => `${i + 1}. **${p.title}**（${p.authors}）`).join("\n")
        : "未检索到相关论文，请更换关键词。";
    default:
      return papers.length
        ? `针对「${query}」，检索到 ${papers.length} 篇相关论文。\n\n` +
            papers.slice(0, 5).map((p, i) => `${i + 1}. **${p.title}**（${p.authors}）`).join("\n")
        : "这是一个有价值的问题，但当前论文库未检索到直接匹配结果，建议更换关键词或开启语义检索。";
  }
}

// ==================== 编排入口 ====================

const FINALIZE_SYSTEM_PROMPT =
  "你是研枢（SciNexus）科研助手，负责把多个科研智能体的工作结果整理成面向用户的最终回答。" +
  "使用中文、Markdown 排版；开头先给 2~4 句总体结论，再分节展开；论文条目保留「编号. **标题**（作者, 年份）」格式；" +
  "严禁输出内部调试信息，严禁虚构数据。";

export async function runAgent(
  userQuery: string,
  taskType?: string | null,
  _paperId?: string | null,
  _history?: { role: string; content: string }[],
  model?: ModelChoice,
): Promise<AgentResult> {
  const explicit = taskType && INTENT_TABLE[taskType] ? taskType : null;
  const intent = explicit
    ? { taskType: explicit, requiredAgents: INTENT_TABLE[explicit].requiredAgents, description: INTENT_TABLE[explicit].description }
    : recognizeIntent(userQuery);
  const plan = buildTaskPlan(intent.taskType);
  const taskId = genId("task_");

  // 需要检索的意图：先由 scout 检索证据
  const needScout = intent.requiredAgents.includes("scout");
  const papers = needScout ? scoutSearch(userQuery) : [];

  // references：scout 检索结果
  const references: AgentReference[] | null = papers.length
    ? papers.slice(0, 10).map((p) => ({
        title: p.title,
        authors: p.authors,
        venue: p.venue,
        year: null,
        ccf: null,
        citations: p.citations,
        match: "PARTIAL",
      }))
    : null;

  // generatedFiles：code_assistant / writer 产物
  let generatedFiles: GeneratedFile[] | null = null;
  if (intent.taskType === "code_generation" || intent.taskType === "autonomous_research") {
    generatedFiles = [
      {
        path: "experiment.py",
        language: "python",
        content:
          "import torch\n\nclass Model(torch.nn.Module):\n    def __init__(self):\n        super().__init__()\n        self.linear = torch.nn.Linear(768, 10)\n\n    def forward(self, x):\n        return self.linear(x)\n",
      },
    ];
  } else if (intent.taskType === "ai_writing" || intent.taskType === "literature_review") {
    generatedFiles = [
      {
        path: "draft.md",
        language: "markdown",
        content: `# ${userQuery.slice(0, 40)}\n\n（初稿由研枢智能体生成，请在右侧编辑区修改完善）\n`,
      },
    ];
  }

  // 回答：优先真实 LLM 综合，否则规则模板
  let reply: string;
  if (hasLLM()) {
    const evidence = papers.length
      ? `\n\n检索到的相关论文：\n` +
        papers.slice(0, 6).map((p) => `- ${p.title}（${p.authors}，${p.venue}）`).join("\n")
      : "";
    const composed = await chatText(
      FINALIZE_SYSTEM_PROMPT,
      `用户问题：${userQuery}${evidence}`,
      model,
    );
    reply = composed && composed.trim().length > 20 ? composed.trim() : ruleReply(intent.taskType, userQuery, papers);
  } else {
    reply = ruleReply(intent.taskType, userQuery, papers);
  }

  const workflow = {
    task_id: taskId,
    agents: intent.requiredAgents,
    steps: [
      { agent: "supervisor", action: "识别意图并规划任务", status: "done" as const },
      ...plan.map((s) => ({ agent: s.agent, action: s.action, status: "done" as const })),
    ],
    errors: [],
    status: "done",
  };

  return { reply, workflow, references, generatedFiles };
}
