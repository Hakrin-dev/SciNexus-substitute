# 深知 ShenZhi · Research OS

> 深知是面向人工智能领域学术科研的**专业可信知识智能体服务平台**,提供论文检索、投稿筛选,以及用于 Deep Research 与 Auto Research 的知识智能体服务。
>
> 本目录是其前端工程:`prototype_v1` SVG 原型的正式 React 实现,**9 个页面已全部完成转换**(7 张 SVG + 2 个知识图谱页),并落地了品牌体系与日/夜模式。

---

## 快速开始

```bash
pnpm install        # pnpm 11:构建脚本白名单见 pnpm-workspace.yaml(sharp)
pnpm dev            # 开发(--turbopack)
pnpm build          # 生产构建
pnpm start          # 启动生产服务
pnpm lint           # ESLint
```

打开 http://localhost:3000 。URL 加 `?theme=dark` / `?theme=light` 可强制日/夜模式(用于调试与分享)。

> **Turbopack 恢复说明**:本副本运行于 WSL2,dev/build 均使用 `--turbopack`(见 package.json)。Windows 侧曾因智能应用控制拦截 Turbopack 原生二进制而临时改用 `--webpack`,该问题仅存在于 Windows 环境,当前副本不受影响。

---

## 部署(已上线 ✅)

**线上地址:http://47.238.241.77**(阿里云香港 ECS,免备案)

```
git push origin main
   │
   ▼
GitHub Actions:docker build → 推 GHCR(私有)→ Trivy 安全扫描 → SSH 到 ECS 部署
   │
   ▼
ECS:/opt/shenzhi, docker compose(80 → web:3000),约 1~3 分钟自动上线
```

- **日常迭代 = `git push`**,无需其他操作;Actions 页面可看每次部署状态
- 镜像:`ghcr.io/hakrin-dev/shenzhi-frontend`(私有,ECS 凭 GHCR_PAT 拉取)
- Dockerfile 多阶段 + `output: 'standalone'`,镜像 ~150MB;构建在 CI 完成,ECS 只拉取运行
- 完整运维文档(Secrets 配置、回滚、扩展后端/数据库):[deploy/README.md](deploy/README.md)

---

## 页面路由(已实现 ✅)

| 路由 | 页面 | 对应原型 | 实现位置 |
|------|------|----------|----------|
| `/` | 主发现页(搜索 + Feed 流) | 深知-主发现页.svg | [app/page.tsx](app/page.tsx) |
| `/submit` | 投稿详情页(期刊/会议 + 倒计时) | 深知-投稿详情页.svg | [app/submit/page.tsx](app/submit/page.tsx) |
| `/papers/[id]` | 论文详情页(沉浸式阅读器) | 深知-论文详情页.svg | [app/papers/[id]/page.tsx](app/papers/[id]/page.tsx) |
| `/scholars` | 学者画像(检索/排序/关注) | 深知-学者画像页.svg | [app/scholars/page.tsx](app/scholars/page.tsx) |
| `/scholars/[id]` | 学者详情(引用图表/发表列表) | 深知-学者详情页.svg | [app/scholars/[id]/page.tsx](app/scholars/[id]/page.tsx) |
| `/knowledge` | 知识库(文献库 + 在读表格) | 深知-知识库页面.svg | [app/knowledge/page.tsx](app/knowledge/page.tsx) |
| `/papers/[id]/graph` | 公域知识图谱(引用关系三栏页) | 知识图谱样页.png | [app/papers/[id]/graph/page.tsx](app/papers/[id]/graph/page.tsx) |
| `/knowledge/graph` | 私域知识图谱(发表×收藏分层双色) | 知识图谱样页.png | [app/knowledge/graph/page.tsx](app/knowledge/graph/page.tsx) |
| `/agents` | AI 研究助手(深度研究对话) | 深知-AI研究助手.svg | [app/agents/page.tsx](app/agents/page.tsx) |

导航联动与 `prototype_v1.html` 热区一致:搜索提交 → `/agents`;论文卡片 → `/papers/[id]`;作者/学者 → `/scholars/[id]`。

---

## 技术栈(当前实际)

| 类别 | 技术 | 状态 |
|------|------|------|
| 框架 | Next.js 16(App Router)+ React 19 + TypeScript | ✅ |
| 样式 | Tailwind CSS 4(CSS-first `@theme`)+ tw-animate-css | ✅ |
| 组件 | 手写 shadcn 风格 UI 原语(cva 变体) | ✅ |
| 服务端数据 | TanStack Query v5(含 placeholderData) | ✅(mock 数据) |
| 客户端状态 | Zustand v5 + persist(点赞/收藏/关注) | ✅ |
| 表单 | React Hook Form + Zod(搜索校验) | ✅ |
| 动效 | Framer Motion(入场动画) | ✅ |
| 图标 | Lucide React | ✅ |
| 包管理 | pnpm 11 | ✅ |
| 编辑器 / 可视化 / 认证 / ORM / 测试 | TipTap、D3.js、NextAuth、Prisma/Drizzle、Vitest + Playwright | 📋 规划选型,待接入真实数据层时引入 |

## 目录结构(实际)

```
frontend_v1/
├── app/                      # 路由(见上表)+ layout.tsx(主题脚本)+ globals.css(令牌)+ icon.png(favicon,由 process_logo.py 生成)
├── components/
│   ├── ui/                   # button / card / badge / input / tabs(cva 变体)
│   ├── layout/               # app-shell / app-sidebar / logo(日/夜双图)/ theme-toggle
│   └── features/             # search / submit / paper / scholar / knowledge / agent / graph
├── lib/
│   ├── data/                 # 原型提取的 mock 数据(papers / venues / scholars / library / agent / knowledge-graph)
│   ├── graph-layout.ts       # 图谱确定性布局(同心环 / 双层带)
│   ├── constants.ts / utils.ts / validations.ts
├── hooks/                    # use-debounce
├── providers/                # query-provider
├── stores/                   # user-preferences(zustand persist)
├── types/                    # 全局类型
├── brand/                    # 品牌资产:logo-day.png / logo-night.png(书法成品,直用勿改,由 logo.tsx 静态导入)+ 母版日间/夜间logo.png 与管线
├── Dockerfile                # 多阶段构建(node:22-alpine,standalone 产物;apk/pnpm 走国内镜像站,本地可构建)
├── docker-compose.yml        # ECS 部署用(CI 每次自动同步到 /opt/shenzhi)
├── .github/workflows/        # deploy.yml:push → 构建 → 推 GHCR → Trivy 扫描 → SSH 部署
├── deploy/README.md          # 部署运维文档
├── .env.example              # 环境变量占位(接后端时填 NEXT_PUBLIC_API_URL 等)
├── demo.html                 # 单文件原型复现(双击即开,引用 ./brand/ 图)
├── docs/superpowers/         # specs(品牌设计规范 v4)+ plans(知识图谱设计)
├── shot_pages.py             # 全页面截图验证(Edge headless)
├── shot_themes.py            # 日/夜模式对比截图
└── shot_graph.py             # 知识图谱页日/夜截图
```

## 品牌与设计令牌

- **标识**:用户书法定稿「深知」日/夜双版(白字黑底 / 黑字白底),成品直用;随主题 CSS 切换,无 JS 闪烁。资产管线见 `brand/process_logo.py`。
- **配色「深识」体系**:主色深识蓝 `#002FA7`(夜间调浅 `#5B84F1`);辅助灵犀紫 / 探索青 / 桂冠金 `#f3d029`(金底一律配墨字)。
- **日/夜模式**:`globals.css` 用 `.dark` 块重定义同名令牌,组件零改动;`layout.tsx` 内联脚本首屏定主题(`?theme=` > localStorage `shenzhi-theme` > 系统偏好);切换按钮在侧边栏 Logo 右侧与移动端顶栏。
- 完整规范:[docs/superpowers/specs/2026-07-29-brand-logo-design.md](docs/superpowers/specs/2026-07-29-brand-logo-design.md)

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
服务端状态   TanStack Query   → 论文列表、检索结果、智能体对话(当前为 mock)
客户端全局   Zustand persist  → 点赞/收藏/关注等用户偏好
组件局部     useState         → 输入值、Tab 切换、面板显隐
URL 状态     useSearchParams  → 搜索关键词、筛选条件、?theme 调试参数
```

### 颜色使用纪律

- 一律走 `globals.css` 令牌(`bg-card`、`text-ink`、`bg-primary` …),**禁止在组件里写死页面结构色**;少数语义徽章色(琥珀/绿/紫)必须成对提供 `dark:` 变体。
- 金(`brand-gold`)只作底色/图标色并配墨字,不作正文文字色(明度高,可读性差)。

### 数据约定

- `lib/data/*.ts` 的内容逐字提取自 SVG 原型,属展示用 mock;接真实后端时替换为 `lib/api/` + Server Actions,组件接口保持不变。

---

## 验证工具

```bash
pnpm build && pnpm start -p 3100   # 先起生产服务(动画页截图更稳定)
python shot_pages.py               # 全页面截图 → %TEMP%(f_home / f_submit / f_paper / f_scholars / f_scholar_detail / f_knowledge / f_agents)
python shot_themes.py              # 日/夜对比截图 → %TEMP%(theme-*-day/night.png)
python shot_graph.py               # 知识图谱日/夜对比截图 → %TEMP%(graph-*-day/night.png)
```

依赖本机 Edge headless;截图时机过早可能捕获到 Framer Motion 入场动画半途(伪影,非缺陷),以 SSR HTML 内容为准。

## 与原型的关系

| 维度 | prototype_v0 / v1 | frontend_v1 |
|------|-------------------|-------------|
| 定位 | 原型探索 | 工程化前端(当前开发基准) |
| 页面 | 7 张 SVG + HTML 热区 | 9 路由完整覆盖(7 SVG + 2 图谱页),热区已转为真实导航 |
| 数据 | 静态 | mock(逐字提取)→ 规划 Server Actions + DB |
| 状态 | 无 | TanStack Query + Zustand persist + URL state |
| 主题 | 无 | 日/夜双模式 + 品牌令牌 |
