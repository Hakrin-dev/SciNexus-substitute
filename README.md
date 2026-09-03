# 研枢 SciNexus

> 研枢是面向人工智能领域学术科研的**个性化自主科研知识智能体平台**,提供论文检索、投稿筛选与自动研究闭环。当前产品 API 以 Next.js Route Handlers 为唯一数据与权限入口；Python 负责自动研究 worker，旧 FastAPI 服务仅保留兼容能力。

---

## 快速开始

**前端**(仓库根目录):

```bash
pnpm install        # pnpm 11:构建脚本白名单见 pnpm-workspace.yaml(sharp)
pnpm dev            # 开发(--turbopack)
pnpm build          # 生产构建
pnpm start          # 启动生产服务
pnpm lint           # ESLint
```

打开 http://localhost:3000 。URL 加 `?theme=dark` / `?theme=light` 可强制日/夜模式(用于调试与分享)。

**自动研究 worker**（开发服务器可按任务自动启动，也可常驻运行）:

```bash
uv run --project backend/auto_research python -m backend.worker.main
```

- 同源产品接口位于 `app/api`，数据和权限统一写入 `data/yanshu.db`。
- 自动研究引擎位于 `backend/auto_research`，队列消费者位于 `backend/worker`；无模型密钥或检索网络不可用时会显式标为降级模式。
- `backend/server` 是旧版 FastAPI 兼容服务，不应再新增项目、成员或自动研究接口。

> **Turbopack 恢复说明**:本副本运行于 WSL2,dev/build 均使用 `--turbopack`(见 package.json)。Windows 侧曾因智能应用控制拦截 Turbopack 原生二进制而临时改用 `--webpack`,该问题仅存在于 Windows 环境,当前副本不受影响。

---

## 部署(已上线 ✅)

**公开演示地址(发给别人用这个):https://izj6c48gbrymjc7orij3jbz.taild0b8bc.ts.net**(Tailscale Funnel,自带 HTTPS,任何网络可开)

**线上地址(仅海外/阿里云内网):http://47.76.187.249**(阿里云香港 ECS,免备案)

> ⚠️ 2026-08-18 起,大陆 → 该公网 IP 的链路被污染(家宽/移动均 TCP 层阻断,服务器本身正常)。日常访问请走 Tailscale 虚拟组网:**http://100.98.100.111**(本机需运行 Tailscale 客户端)。SSH 同理(`scinexus-ecs` 别名已指向 100.x 地址,不再走跳板)。

```
git push origin main
   │
   ▼
GitHub Actions:docker build → 推 GHCR(私有)→ Trivy 安全扫描
   │
   ▼
ECS:Watchtower 每 60s 轮询 GHCR,发现新镜像自动 pull + 重建(/opt/scinexus,80 → web:3000)
```

- **日常迭代 = `git push`**,无需其他操作;Actions 页面可看每次部署状态
- 镜像:`ghcr.io/hakrin-dev/scinexus-frontend`(私有,ECS 凭 GHCR_PAT 拉取)
- Dockerfile 多阶段 + `output: 'standalone'`,镜像 ~150MB;构建在 CI 完成,ECS 只拉取运行
- **线上目前仅前端容器化**;后端容器化方案(api 服务 + CI 后端镜像)已开发但回滚(56dfc12),线上前端请求失败时回退 mock。后端当前在本地/开发环境用 uvicorn 运行
- 完整运维文档(Secrets 配置、回滚、扩展后端/数据库):[deploy/README.md](deploy/README.md)

---

## 页面路由(已实现 ✅)

| 路由 | 页面 | 实现位置 |
|------|------|----------|
| `/` | 主发现页(搜索 + Feed 流) | [app/page.tsx](app/page.tsx) |
| `/agents` | AI 研究助手(单容器对话:快速=参考卡,深度=工作流条+参考卡;历史可回放) | [app/agents/page.tsx](app/agents/page.tsx);`/agents/deep-search` 为兼容重定向 |
| `/projects` | 课题工作台(仅展示「进行中」课题,空则跳 `/my-projects`) | [app/projects/page.tsx](app/projects/page.tsx) |
| `/projects/[id]` | 课题工作台详情(概览/线程/大纲/资产/日志;`?studio=1` AI 生成台) | [app/projects/[id]/page.tsx](app/projects/[id]/page.tsx) |
| `/projects/new` | 新建持久化课题向导 | [app/projects/new/page.tsx](app/projects/new/page.tsx) |
| `/submit` | 投稿详情页(期刊/会议 + 倒计时) | [app/submit/page.tsx](app/submit/page.tsx) |
| `/submit/match` | AI 投稿匹配(标题/摘要 → Top5 会议/期刊,LLM 语义匹配可回退关键词) | [app/submit/match/page.tsx](app/submit/match/page.tsx) |
| `/submit/history` | 投稿历史 | [app/submit/history/page.tsx](app/submit/history/page.tsx) |
| `/papers/[id]` | 论文详情页(沉浸式阅读器) | [app/papers/[id]/page.tsx](app/papers/[id]/page.tsx) |
| `/papers/[id]/graph` | 公域知识图谱(引用关系三栏页) | [app/papers/[id]/graph/page.tsx](app/papers/[id]/graph/page.tsx) |
| `/scholars` · `/scholars/[id]` | 学者画像 / 详情 | [app/scholars/page.tsx](app/scholars/page.tsx) |
| `/knowledge` | 知识库(索引) | [app/knowledge/page.tsx](app/knowledge/page.tsx) |
| `/knowledge/papers` | 论文库(全部 / 期刊 / 会议 三个标签页) | [app/knowledge/papers/page.tsx](app/knowledge/papers/page.tsx) |
| `/knowledge/notes` | 笔记(标题前 Feather 图标) | [app/knowledge/notes/page.tsx](app/knowledge/notes/page.tsx) |
| `/knowledge/memory` | AI 记忆(总开关 + 条目管理,标题前 Brain 图标) | [app/knowledge/memory/page.tsx](app/knowledge/memory/page.tsx) |
| `/knowledge/database` | 科研数据库(跨库检索,前端 mock) | [app/knowledge/database/page.tsx](app/knowledge/database/page.tsx) |
| `/knowledge/graph` | 私域知识图谱(发表×收藏分层双色) | [app/knowledge/graph/page.tsx](app/knowledge/graph/page.tsx) |
| `/tools` | 工具库(索引) | [app/tools/page.tsx](app/tools/page.tsx) |
| `/tools/skills` | 技能 | [app/tools/skills/page.tsx](app/tools/skills/page.tsx) |
| `/tools/plugins` | 插件 | [app/tools/plugins/page.tsx](app/tools/plugins/page.tsx) |
| `/tools/mcp` | MCP(我的服务器 / 配置说明 双标签页) | [app/tools/mcp/page.tsx](app/tools/mcp/page.tsx) |
| `/history` | 浏览记录 | [app/history/page.tsx](app/history/page.tsx) |
| `/my-projects` | 归档项目（恢复与删除走真实权限接口） | [app/my-projects/page.tsx](app/my-projects/page.tsx) |

> `/database` 已重定向至 `/knowledge/database`(数据库自 2026-08-27 起迁入知识库子导航)。
>
> **前端演示态**:课题的新建 / 归档 / 删除与科研数据库检索均为纯前端演示状态([stores/demo-state.ts](stores/demo-state.ts) + [lib/data/database.ts](lib/data/database.ts) mock),**不调用后端**;其余接口仍走「真实 API + mock 保底」([lib/api/services.ts](lib/api/services.ts))。

课题详情的「自动研究模式」使用真实持久化队列，不回退 mock。Web 服务初始化数据库后，需同时运行 `python -m backend.worker.main`；Docker Compose 已配置共享数据卷和独立 worker 服务。详见 [backend/worker/README.md](backend/worker/README.md)。

导航联动与 `prototype_v1.html` 热区一致:搜索提交 → `/agents`;论文卡片 → `/papers/[id]`;作者/学者 → `/scholars/[id]`。

---

## 后端与多智能体(backend/)

FastAPI 单体服务,内含两块:`server/`(REST/SSE API + 序列化 + 数据层)与 `agent/`(LangGraph 多智能体框架 + 本地语料)。

**API 面**(server/main.py,约 40 个端点):论文/检索/全文/图谱、对话与 SSE 流式问答(`/api/chat/stream`)、翻译流、期刊与投稿匹配、学者/机构/项目、知识库 CRUD、收藏、通知、统计。接口契约「前端优先」——字段用前端命名(tags/citations 数字/abbr),视觉字段(颜色/徽章/倒计时)由前端 [lib/api/adapters.ts](lib/api/adapters.ts) 派生。

**AI 助手双模式**(前端右下角切换):

| 模式 | 路径 | 特点 |
|------|------|------|
| 快速(默认) | `/api/search` → scout 数据层本地直检(三路 RRF + 可选交叉编码器精排)+ 后端简易回答 | 秒级,零 LLM 调用;发现页入口默认走此 |
| 深度 | `/api/chat/stream` → Supervisor 规划的完整多智能体工作流(SSE 逐 token 推送) | scout→synthesis→LLM 组合回答,附工作流元信息与参考文献 |

**智能体**(agent/research_assistant/agents/,由 Supervisor 按意图路由):

| Agent | 职责 |
|-------|------|
| scout | 论文检索(混合召回 + 精排) |
| librarian | 研究图谱构建 |
| synthesis | 检索结果综合回答 / AI 辅助阅读 |
| research_design | 研究方案生成 |
| code_assistant | 实验代码生成与算法复现 |
| writer | 论文/综述写作(见下) |
| critic | 审稿 + 投稿匹配,反馈回写 writer 定向修订 |

**文献综述三阶段管线**([review.py](backend/agent/research_assistant/review.py),writer 的 literature_review 分支):

1. **论断提取**:逐篇从摘要提取忠实论断(结构化输出)
2. **聚类**:论断聚为 3–6 个研究维度,漏归论文补聚类(全分划不变式:论断不静默丢失)
3. **成文**:逐维度散文成文 + 摘要;引用全局编号 [n],`resolve_citations` 重编号、剔除悬空引用、自动生成参考文献(零幽灵引用)

critic 的 ReviewReport 会转成可执行审稿意见,writer 据此**定向修订**(不重跑提取/聚类),形成 writer→critic→writer 回环。mock 模式与真实模式走同一条代码路径。

**数据层**:`TOOL_DATA_SOURCE=sqlite` 读 `server/data/research.sqlite`(OpenAlex 入库语料,脚本见 agent/scripts/);加载失败逐级回退 json → server_mock → 内置兜底。PDF 全文在 `server/data/pdfs/`,缺失时 fulltext 回退摘要 + 结构化分析。

---

## 技术栈(当前实际)

| 类别 | 技术 | 状态 |
|------|------|------|
| 前端框架 | Next.js 16(App Router)+ React 19 + TypeScript | ✅ |
| 样式 | Tailwind CSS 4(CSS-first `@theme`)+ tw-animate-css | ✅ |
| 组件 | 手写 shadcn 风格 UI 原语(cva 变体) | ✅ |
| 服务端数据 | TanStack Query v5(真实 API + mock 保底,见 lib/api/) | ✅ 已接后端 |
| 客户端状态 | Zustand v5 + persist(点赞/收藏/关注) | ✅ |
| 表单 | React Hook Form + Zod(搜索校验) | ✅ |
| 动效 | Framer Motion(入场动画) | ✅ |
| 图标 | Lucide React | ✅ |
| 包管理 | pnpm 11 | ✅ |
| 后端 | FastAPI + Uvicorn + SSE(sse-starlette)+ slowapi 限流 | ✅ |
| 智能体框架 | LangGraph + langchain-openai(OpenAI 兼容协议,结构化输出;DeepSeek 等可配 base_url) | ✅ |
| 后端数据 | SQLite 本地语料 + PyMuPDF/pypdf 全文解析 + networkx 图谱 | ✅ |
| 编辑器 / 可视化 / 认证 / ORM / 测试 | TipTap、D3.js、NextAuth、Prisma/Drizzle、Vitest + Playwright | 📋 规划选型,待需要时引入 |

## 目录结构(实际)

```
scinexus/
├── app/                      # 路由(见上表)+ layout.tsx(主题脚本)+ globals.css(令牌)+ icon.png(favicon,由 process_logo.py 生成)
├── components/
│   ├── ui/                   # button / card / badge / input / tabs(cva 变体)
│   ├── layout/               # app-shell / app-sidebar / logo(日/夜双图)/ theme-toggle
│   └── features/             # search / submit / paper / scholar / knowledge / agent / graph
├── lib/
│   ├── api/                  # 后端对接:client.ts(fetch + SSE)/ services.ts(查询 hooks,真实 + mock 保底)/ adapters.ts(字段适配)
│   ├── data/                 # 原型提取的 mock 数据(后端不可达时的保底)
│   ├── graph-layout.ts       # 图谱确定性布局(同心环 / 双层带)
│   ├── constants.ts / utils.ts / validations.ts / citations.tsx / cite.ts
├── backend/                  # FastAPI 后端(见「后端与多智能体」节)
│   ├── server/               # main.py(API)/ agent_gateway.py / data/(sqlite + PDF 语料)
│   └── agent/                # research_assistant/(supervisor + 7 agents + tools + review 管线)/ scripts/(OpenAlex/PDF 入库)
├── hooks/                    # use-debounce
├── providers/                # query-provider
├── stores/                   # zustand persist:用户偏好 + 课题/记忆演示态(demo-state)
├── types/                    # 全局类型
├── brand/                    # 品牌资产:logo-wordmark.png(SciNexus 透明字标,日夜通用,由 logo.tsx 静态导入)+ 母版 logo.png 与管线(process_brand_assets.cjs)
├── Dockerfile                # 前端多阶段构建(node:22-alpine,standalone 产物;apk/pnpm 走国内镜像站,本地可构建)
├── docker-compose.yml        # ECS 部署用(仓库为唯一事实来源,改动后手动同步到 /opt/scinexus)
├── .github/workflows/        # deploy.yml:push → 构建 → 推 GHCR → Trivy 扫描(ECS 端 Watchtower 拉取式更新)
├── deploy/README.md          # 部署运维文档
├── .env.example              # 环境变量占位(NEXT_PUBLIC_API_URL 等)
├── demo.html                 # 单文件原型复现(双击即开,引用 ./brand/ 图)
├── shot_pages.py             # 全页面截图验证(Edge headless)
├── shot_themes.py            # 日/夜模式对比截图
└── shot_graph.py             # 知识图谱页日/夜截图
```

## 品牌与设计令牌

- **标识**:SciNexus 英文透明字标(自 `brand/logo.png` 提取,日夜通用),展开侧边栏居上 +「研枢」与折叠键并列;折叠态为橙底白三十字星(lucide Sparkles,同 `app/icon.png`)。资产管线见 `brand/process_brand_assets.cjs`。
- **配色「深识」体系**:主色深识蓝 `#002FA7`(夜间调浅 `#5B84F1`);辅助灵犀紫 / 探索青 / 桂冠金 `#f3d029`(金底一律配墨字)。
- **日/夜模式**:`globals.css` 用 `.dark` 块重定义同名令牌,组件零改动;`layout.tsx` 内联脚本首屏定主题(`?theme=` > localStorage `scinexus-theme` > 系统偏好);切换按钮在侧边栏 Logo 右侧与移动端顶栏。
- 完整规范:见本地 `docs/superpowers/specs/`(仅本地工作文档,不入库)

---

## 开发规范

### 命名约定

| 目标 | 约定 | 示例 |
|------|------|------|
| 文件名 | kebab-case | `paper-card.tsx`、`use-debounce.ts` |
| 组件名 | PascalCase | `PaperCard`、`SearchHero` |
| 函数/变量 | camelCase | `getPaperById` |
| 类型/接口 | PascalCase | `Paper`、`Scholar` |
| 常量 | UPPER_SNAKE_CASE | `SITE`、`LEVEL_CHIPS` |
| 动态路由 | 方括号 | `[id]` |

### 状态管理分层

```
服务端状态   TanStack Query   → 论文列表、检索结果、智能体对话(真实 API,失败自动回退 mock)
客户端全局   Zustand persist  → 点赞/收藏/关注等用户偏好
组件局部     useState         → 输入值、Tab 切换、面板显隐
URL 状态     useSearchParams  → 搜索关键词、筛选条件、?theme 调试参数
```

### 颜色使用纪律

- 一律走 `globals.css` 令牌(`bg-card`、`text-ink`、`bg-primary` …),**禁止在组件里写死页面结构色**;少数语义徽章色(琥珀/绿/紫)必须成对提供 `dark:` 变体。
- 金(`brand-gold`)只作底色/图标色并配墨字,不作正文文字色(明度高,可读性差)。

### 数据约定

- 前端数据统一走 [lib/api/services.ts](lib/api/services.ts) 的查询 hooks:**真实接口 + mock 保底**——API 可用时返回真实数据,请求失败(后端未启动等)自动回退到 `lib/data/` 的 mock,组件接口不变。
- `lib/data/*.ts` 的内容逐字提取自 SVG 原型,仅作离线保底与 placeholderData;后端字段经 `lib/api/adapters.ts` 适配为前端命名,视觉字段(颜色/徽章/倒计时)一律在前端派生。

---

## 验证工具

```bash
pnpm build && pnpm start -p 3100   # 先起生产服务(动画页截图更稳定)
python shot_pages.py               # 全页面截图 → %TEMP%(f_home / f_submit / f_paper / f_scholars / f_scholar_detail / f_knowledge / f_agents)
python shot_themes.py              # 日/夜对比截图 → %TEMP%(theme-*-day/night.png)
python shot_graph.py               # 知识图谱日/夜对比截图 → %TEMP%(graph-*-day/night.png)
```

依赖本机 Edge headless;截图时机过早可能捕获到 Framer Motion 入场动画半途(伪影,非缺陷),以 SSR HTML 内容为准。

## 与深知的关系

研枢于 2026-08-13 从[深知(shenzhi)](https://github.com/Hakrin-dev)用 `git clone --local` 派生,是两个独立演进的姊妹项目(共用 WSL + pnpm + turbopack 工具链)。主要差异:

| 维度 | 深知 shenzhi | 研枢 scinexus |
|------|--------------|----------------|
| 页面 | 含 Deep Research、Auto Research、专利库、项目基金库 | 已删除上述 4 个页面及专属组件/数据/类型,聚焦检索·投稿·知识库·AI 助手 |
| 品牌 | 深知 / ShenZhi | 研枢 / SciNexus(新字标 + 橙底白星折叠态) |
| 隔离 | localStorage `shenzhi-*` | localStorage `scinexus-*`(避免 localhost:3000 冲突) |
| 部署 | 47.76.152.223,镜像 `shenzhi-frontend`,ECS 路径 `/opt/shenzhi` | 47.76.187.249,镜像 `scinexus-frontend`,ECS 路径 `/opt/scinexus` |
| AI 助手 | 有子栏目 | 无子栏目,侧边栏普通 NavLink(matchPrefix=/agents) |
| 后端 | — | 自带 FastAPI 多智能体后端(backend/,移植自 SciNexus-proto) |
