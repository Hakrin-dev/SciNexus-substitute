"use client";

import * as React from "react";
import { BookOpen, Code2, Library, Search, Check, ChevronRight, Copy } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { copyText } from "@/stores/toast";
import { cn } from "@/lib/utils";

/**
 * MCP 页说明与引导(alphaXiv 风格):
 * 介绍 → Getting started 参数表 → Quick start 客户端切换 → 工具文档(分组/参数表/示例)
 * → 常见用例卡片。数据为演示契约,与设置·API Keys 联动。
 */

/* ── Getting started ──────────────────────────────────────── */

const ENDPOINT = "http://localhost:8000/mcp/v1";

const GETTING_STARTED: { label: string; value: React.ReactNode }[] = [
  {
    label: "Endpoint",
    value: (
      <span className="flex items-center gap-2">
        <code className="rounded bg-panel px-2 py-0.5 font-mono text-[12px] text-ink">
          {ENDPOINT}
        </code>
        <EndpointCopy />
      </span>
    ),
  },
  {
    label: "Transport",
    value: "Streamable HTTP(POST 发起请求,GET 接收 SSE 流,DELETE 终止会话)",
  },
  {
    label: "Authentication",
    value: (
      <>
        默认走 OAuth 2.1:首次使用时 MCP 客户端会拉起浏览器登录,令牌由客户端自行刷新。
        <br />
        脚本 / CLI 等非交互场景,可在
        <code className="mx-1 rounded bg-panel px-1.5 py-0.5 text-[11px]">设置 → API Keys</code>
        创建密钥,以请求头
        <code className="mx-1 rounded bg-panel px-1.5 py-0.5 text-[11px]">Authorization: Bearer &lt;key&gt;</code>
        直连,跳过 OAuth 流程;删除密钥立即失效。
      </>
    ),
  },
  { label: "Protocol", value: "Model Context Protocol(MCP)v1.0.0" },
  {
    label: "Supported clients",
    value: (
      <>
        原生 MCP 客户端:Claude Code、Claude Desktop、Cursor、VS Code、Zed 及 CLI 桥接。
        <br />
        浏览器内直连(如网页版 Claude)因 CORS 限制不受支持,可经本地桥接(如 mcp-remote)转发。
      </>
    ),
  },
];

function EndpointCopy() {
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      type="button"
      aria-label="复制 Endpoint"
      onClick={async () => {
        if (await copyText(ENDPOINT, "Endpoint 已复制")) {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        }
      }}
      className="cursor-pointer rounded-md p-1 text-faint transition-colors hover:bg-chip hover:text-primary"
    >
      {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
    </button>
  );
}

/* ── Quick start ──────────────────────────────────────────── */

const QUICK_START: { client: string; code: string }[] = [
  {
    client: "Claude Code",
    code: `# 交互式授权(OAuth 2.1,首次使用自动拉起浏览器)
claude mcp add --transport http yanshu ${ENDPOINT}

# 或使用 API Key 免交互认证(设置 → API Keys 创建)
claude mcp add --transport http yanshu ${ENDPOINT} --header "Authorization: Bearer <key>"`,
  },
  {
    client: "Cursor",
    code: `# Cursor → Settings → MCP → Add Server,填入:
#   Name: yanshu
#   URL:  ${ENDPOINT}
# 保存后 Status 变绿即可在对话中使用研枢工具`,
  },
  {
    client: "VS Code",
    code: `# 在 settings.json 的 mcp.servers 中追加:
"yanshu": {
  "url": "${ENDPOINT}",
  "headers": { "Authorization": "Bearer <key>" }
}`,
  },
  {
    client: "通用 JSON",
    code: `{
  "mcpServers": {
    "yanshu": {
      "url": "${ENDPOINT}",
      "transport": "http",
      "auth": "oauth"
    }
  }
}`,
  },
];

function QuickStart() {
  const [active, setActive] = React.useState(0);
  const [copied, setCopied] = React.useState(false);
  const current = QUICK_START[active];

  return (
    <div className="rounded-2xl border border-line bg-card p-1.5 shadow-card">
      <div className="flex flex-wrap items-center gap-1 px-1.5 pt-1">
        {QUICK_START.map((q, i) => (
          <button
            key={q.client}
            type="button"
            aria-pressed={active === i}
            onClick={() => setActive(i)}
            className={cn(
              "cursor-pointer rounded-lg px-3 py-1.5 text-[13px] transition-colors",
              active === i
                ? "bg-primary-soft font-medium text-primary"
                : "text-muted hover:text-ink-2",
            )}
          >
            {q.client}
          </button>
        ))}
        <button
          type="button"
          title="复制命令"
          onClick={async () => {
            if (await copyText(current.code, "命令已复制")) {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            }
          }}
          className="ml-auto cursor-pointer rounded-md p-1.5 text-faint transition-colors hover:bg-chip hover:text-primary"
        >
          {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
        </button>
      </div>
      <pre className="overflow-x-auto rounded-xl bg-sidebar p-4 font-mono text-[12px] leading-relaxed text-ink-2">
        {current.code}
      </pre>
    </div>
  );
}

/* ── 工具文档 ─────────────────────────────────────────────── */

interface ToolParam {
  name: string;
  type: string;
  required?: boolean;
  desc: string;
}

interface ToolDoc {
  name: string;
  badge?: "Destructive" | "Writes";
  desc: string;
  params: ToolParam[];
  returns: string;
  examples: number;
}

interface ToolGroup {
  title: string;
  desc: string;
  tools: ToolDoc[];
}

const TOOL_GROUPS: ToolGroup[] = [
  {
    title: "检索工具",
    desc: "搜索与发现论文。检索类工具会调用研枢检索管线,计入助手配额。",
    tools: [
      {
        name: "discover_papers",
        desc: "为研究主题发现并排序候选论文。内部运行智能体检索回路:关键词召回 + 语义召回 + 可选多轮追问。适合文献发现、相关工作与宽泛主题调研。",
        params: [
          { name: "keywords", type: "string[]", required: true, desc: "3~4 个精确关键词,用于全名、缩写、方法、基准或标题匹配。" },
          { name: "question", type: "string", required: true, desc: "希望被回答的研究问题的语义描述,包含重要概念、方法与应用。" },
          { name: "difficulty", type: "number (1-10)", required: true, desc: "检索努力程度估计;越高越可能触发多轮追问,耗时更长。" },
          { name: "published_after", type: "string", desc: "仅返回该日期(YYYY-MM-DD)之后首次发表的论文。" },
        ],
        returns: "按优先级排序的 5-15 篇论文:标题、发表时间、机构、摘要预览与 arXiv ID。",
        examples: 3,
      },
      {
        name: "search_library",
        desc: "在用户知识库(文献库 + 收藏)中检索,支持按文件夹、标签与阅读状态过滤,适合「我之前读过的…」类请求。",
        params: [
          { name: "query", type: "string", required: true, desc: "对目标文献的自然语言描述。" },
          { name: "folder", type: "string", desc: "限定文件夹名,缺省检索全部文件夹。" },
          { name: "status", type: "string", desc: "按阅读状态过滤:unread / reading / read。" },
        ],
        returns: "命中的文献条目:标题、作者、venue、加入时间与所在文件夹。",
        examples: 2,
      },
    ],
  },
  {
    title: "知识库工具",
    desc: "管理文献库文件夹并编辑论文元数据。文件夹由 list_library 返回的 folder_id 寻址;「想读 / 在读 / 已读」为默认阅读状态文件夹,一篇论文可同时属于多个文件夹。",
    tools: [
      {
        name: "save_papers_to_folder",
        badge: "Writes",
        desc: "把一篇或多篇论文加入文件夹。不在库中的论文会自动从 arXiv 拉取;操作幂等,不会把论文从其他文件夹移除。",
        params: [
          { name: "paper_ids_or_urls", type: "string[] (1-50)", required: true, desc: "arXiv ID 或论文 URL 列表。" },
          { name: "folder_id", type: "string", desc: "目标文件夹;缺省为「想读」文件夹。" },
        ],
        returns: "目标文件夹 id,以及每篇论文是新增、已存在还是未找到。",
        examples: 2,
      },
      {
        name: "get_paper_content",
        desc: "以文本形式读取论文内容。默认返回面向 LLM 的结构化中间报告;传 fullText=true 时返回逐页原始抽取文本。",
        params: [
          { name: "url", type: "string (URL)", required: true, desc: "arXiv / alphaXiv 链接或论文 ID(如 2307.12307)。" },
          { name: "fullText", type: "boolean", desc: "为 true 时跳过报告,直接返回原始抽取文本。" },
        ],
        returns: "论文内容文本;默认为结构化报告,fullText=true 时为逐页原文。",
        examples: 3,
      },
    ],
  },
  {
    title: "分析工具",
    desc: "对已检索到的论文做深入分析:跨页问答与多篇对比。同一论文的多个问题建议合并到一次调用。",
    tools: [
      {
        name: "answer_pdf_queries",
        desc: "返回单篇 PDF 中与一个或多个查询相关的页面级内容,输出 XML(<paper><page num=…>…),可直接用于构造页级引用。多篇论文请并行调用。",
        params: [
          { name: "paper", type: "string", required: true, desc: "要读取的论文:ID、URL 或标题,自动解析为最佳匹配。" },
          { name: "queries", type: "string[]", required: true, desc: "一个或多个信息需求简述;同一论文的所有问题请合并进一次调用。" },
        ],
        returns: "仅包含相关页面的 XML:paper id + 页码 + 页面文本,可直接构造引用。",
        examples: 3,
      },
      {
        name: "compare_papers",
        badge: "Writes",
        desc: "对 2-6 篇论文做方法×贡献对照分析,输出对比表草稿与差异要点,适合综述的相关工作章节。",
        params: [
          { name: "paper_ids_or_urls", type: "string[] (2-6)", required: true, desc: "待对比的论文列表。" },
          { name: "dimensions", type: "string[]", desc: "对比维度(如 方法/数据集/指标);缺省自动归纳。" },
        ],
        returns: "Markdown 对比表 + 每篇论文的差异化要点。",
        examples: 1,
      },
    ],
  },
];

function Badge({ kind }: { kind: NonNullable<ToolDoc["badge"]> }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-semibold",
        kind === "Destructive"
          ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
          : "bg-chip text-muted",
      )}
    >
      {kind}
    </span>
  );
}

function ParamTable({ params }: { params: ToolParam[] }) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-faint">
        Parameters
      </p>
      <div className="overflow-hidden rounded-lg border border-line">
        {params.map((p, i) => (
          <div
            key={p.name}
            className={cn(
              "px-3.5 py-2.5",
              i > 0 && "border-t border-line",
              i % 2 === 0 ? "bg-card" : "bg-panel/60",
            )}
          >
            <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <code className="font-mono text-[12px] font-semibold text-ink">{p.name}</code>
              <code className="font-mono text-[11px] text-muted">{p.type}</code>
              {p.required ? (
                <span className="rounded bg-danger-soft px-1.5 py-0.5 text-[10px] font-medium text-danger">
                  required
                </span>
              ) : (
                <span className="rounded bg-chip px-1.5 py-0.5 text-[10px] text-muted">optional</span>
              )}
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted">{p.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ToolItem({ tool }: { tool: ToolDoc }) {
  const [open, setOpen] = React.useState(false);
  return (
    <article className="border-t border-line py-5 first:border-t-0">
      <div className="flex items-center gap-2">
        <code className="font-mono text-[13px] font-semibold text-ink">{tool.name}</code>
        {tool.badge && <Badge kind={tool.badge} />}
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-muted">{tool.desc}</p>
      <div className="mt-3 space-y-3">
        <ParamTable params={tool.params} />
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-faint">
            Returns
          </p>
          <p className="text-[12px] leading-relaxed text-muted">{tool.returns}</p>
        </div>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex cursor-pointer items-center text-[12px] font-medium text-primary hover:underline"
        >
          <ChevronRight
            className={cn("size-3.5 transition-transform", open && "rotate-90")}
          />
          Examples({tool.examples})
        </button>
        {open && (
          <div className="animate-in fade-in slide-in-from-bottom-1 space-y-2 rounded-lg bg-sidebar p-3 font-mono text-[11px] leading-relaxed text-ink-2 duration-200">
            <p>{`# ${tool.name} 调用示例`}</p>
            <p className="break-all">
              {`{ "tool": "${tool.name}", "arguments": { ${tool.params
                .filter((p) => p.required)
                .map((p) =>
                  p.type.startsWith("string[]")
                    ? `"${p.name}": ["…"]`
                    : p.type.startsWith("number")
                      ? `"${p.name}": 5`
                      : `"${p.name}": "…"`
                )
                .join(", ")} } }`}
            </p>
          </div>
        )}
      </div>
    </article>
  );
}

/* ── 常见用例 ─────────────────────────────────────────────── */

const USE_CASES: { icon: LucideIcon; title: string; steps: string[] }[] = [
  {
    icon: Library,
    title: "文献综述",
    steps: [
      "用 discover_papers 找到主题候选论文",
      "换关键词或提高 difficulty 补齐覆盖面",
      "用 answer_pdf_queries 批量抽取页级引用",
      "跨论文综合成文",
    ],
  },
  {
    icon: Code2,
    title: "代码分析",
    steps: [
      "discover_papers 找到目标论文",
      "从结果或元数据中提取 GitHub 链接",
      "read_files_from_github_repository 以 path=/ 概览,再深入目录",
    ],
  },
  {
    icon: Search,
    title: "深度研究",
    steps: [
      "discover_papers(可多角度并行)找到文献",
      "get_paper_content 读全文或结构化报告",
      "answer_pdf_queries 抽取引用级页摘",
      "read_files_from_github_repository 验证实现声明",
    ],
  },
  {
    icon: BookOpen,
    title: "知识库整理",
    steps: [
      "search_library 查看现有文献分布",
      "save_papers_to_folder 按主题归档",
      "compare_papers 生成同主题对照表,辅助去重与精读排序",
    ],
  },
];

/* ── 主组件 ─────────────────────────────────────────────── */

export function McpGuide() {
  return (
    <div className="space-y-10">
      {/* 介绍 */}
      <div>
        <h2 className="text-lg font-bold text-ink">MCP Server</h2>
        <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-muted">
          研枢模型上下文协议(MCP)服务器让 AI
          应用、智能体与工作流以编程方式访问你的科研语料:检索并阅读论文、分析
          PDF、探索论文代码库、找到论文背后的研究者、管理你的文献库 —— 全部通过原生
          MCP 工具完成。
        </p>
      </div>

      {/* Getting started */}
      <section>
        <h3 className="text-[15px] font-bold text-ink">Getting started</h3>
        <div className="mt-3 overflow-hidden rounded-xl border border-line">
          {GETTING_STARTED.map((row, i) => (
            <div
              key={row.label}
              className={cn(
                "grid gap-2 px-4 py-3 sm:grid-cols-[140px_1fr] sm:gap-6",
                i % 2 === 0 ? "bg-card" : "bg-panel/50",
                i > 0 && "border-t border-line",
              )}
            >
              <p className="text-xs font-semibold text-ink">{row.label}</p>
              <p className="min-w-0 text-[12px] leading-relaxed text-muted">{row.value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Quick start */}
      <section>
        <h3 className="text-[15px] font-bold text-ink">Quick start</h3>
        <div className="mt-3">
          <QuickStart />
        </div>
      </section>

      {/* Available tools */}
      <section>
        <h3 className="text-[15px] font-bold text-ink">Available tools</h3>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          服务器暴露 {TOOL_GROUPS.reduce((n, g) => n + g.tools.length, 0)}{" "}
          个工具,按三组组织。组合它们即可构建「发现 → 阅读 → 整理」的研究工作流。
        </p>
        <div className="mt-4 space-y-8">
          {TOOL_GROUPS.map((group) => (
            <div key={group.title}>
              <h4 className="text-sm font-bold text-ink">{group.title}</h4>
              <p className="mt-1 text-[12px] leading-relaxed text-muted">{group.desc}</p>
              <div className="mt-1">
                {group.tools.map((tool) => (
                  <ToolItem key={tool.name} tool={tool} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Common use cases */}
      <section>
        <h3 className="text-[15px] font-bold text-ink">Common use cases</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {USE_CASES.map((uc) => (
            <div key={uc.title} className="rounded-xl border border-line bg-card p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <uc.icon className="size-4 text-primary" strokeWidth={1.8} />
                  {uc.title}
                </p>
              <ol className="mt-2.5 space-y-1.5">
                {uc.steps.map((step, si) => (
                  <li key={si} className="flex gap-2 text-[12px] leading-relaxed text-muted">
                    <span className="shrink-0 font-medium tabular-nums text-faint">
                      {si + 1}.
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
