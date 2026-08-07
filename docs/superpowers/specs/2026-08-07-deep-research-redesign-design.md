# Deep Research 页面重设计:研究报告型双栏工作台 + 旧页迁移为深度搜索

日期:2026-08-07
状态:已获用户批准(定位=研究报告型,布局=方案 B 双栏工作台)

## 背景

AI 助手栏目下现有三页:

- `/agents` —— ChatGPT 式快速对话
- `/agents/deep-research` —— Perplexity 式单轮带引用答案页(ResearchNav + AnswerCard + ReferenceGrid + FollowUps + ChatInput),同时是发现页「深度搜索」按钮的跳转目标
- `/agents/auto-research` —— 自治研究流水线(流程画布 + 诚信门 + 预录事件流)

用户决策:

1. 现有 `/agents/deep-research` 页语义上是「深度搜索结果页」,迁移为发现页「深度搜索」按钮的专属跳转目标;
2. 侧边栏 Deep Research 入口(`/agents/deep-research`)由全新设计接管,定位为**研究报告型**:提问 → 生成研究计划(可展示编辑)→ agent 多轮检索阅读(过程可见)→ 产出带引用的长篇结构化报告。

三档产品阶梯由此清晰:深度搜索=单轮快答;Deep Research=过程可见的报告工作台;Auto Research=可编排的多阶段自治流水线。

## 路由迁移(旧页 → 深度搜索)

- `git mv app/agents/deep-research app/agents/deep-search`,页面内容与 `components/features/agent/*` 组件(answer-card / reference-grid / follow-ups / chat-input / research-nav)原样保留,仅更新页头注释为「深度搜索结果页 —— 发现页『深度搜索』跳转目标」。
- `components/features/search/search-hero.tsx` 第 32 行跳转改为 `/agents/deep-search?q=…`。
- `/agents/deep-search` 不进侧边栏子栏目(仅为发现页跳转目标);侧边栏 AGENT_SUB_NAV 的 Deep Research 仍指 `/agents/deep-research`,无需改动。
- 原型阶段不留 `/agents/deep-research` → 旧内容的 redirect。

## 新页架构:`/agents/deep-research` 单路由两视图

页面为 client 组件,内部视图机:`view: "home" | "session"`。

### 视图 1:入口态(home,默认)

自上而下、居中窄栏(约 720px):

1. Hero:标题「Deep Research」+ 一句话定位(「围绕一个问题,阅读数十篇文献,产出带引用的研究报告」);
2. 研究问题输入卡:多行 textarea + 范围 chips(全网文献 / 我的知识库 / 近 12 个月,单选切换、纯展示)+「开始研究」主按钮;
3. 建议主题:3 个 chips(如「扩散策略工业部署现状」「世界模型 vs VLA 路线」「具身智能评测基准综述」),点击填入输入框,不直接开跑;
4. 历史研究列表:卡片行(标题、状态徽标[已完成/进行中]、N 来源 · 时间),点击进入 session 完成态(原型只有一份示例报告,所有历史卡片均加载它)。

提交(按钮或 `?q=非空`)→ 进入 session 视图并从头播放运行。

### 视图 2:Session 工作台(session)

- **顶条**:← 返回(回 home 并重置运行)、研究问题(截断)、状态徽标 + 实时耗时(m:ss)、导出/分享按钮(仅展示,无行为);
- **左栏(约 360px,可折叠为 48px 细条,折叠状态为 workbench 内 useState)**:
  - 研究计划卡:大纲 4 节,每节状态点(待做灰 / 进行蓝 / 完成绿),由事件流派生;「可编辑」仅样式提示,不做真实编辑;
  - 步骤时间线:检索/精读/分析/撰写步骤,带来源计数,随播放逐条出现;
  - 来源墙:已收集来源 chips(短标题),hover 显示完整标题 + venue;
- **右栏(flex-1)报告区**:
  - 报告头:报告标题、摘要、关键数字条(阅读 N 篇 · 引用 M 篇 · 耗时);
  - 章节区按事件流逐节生成:已生成=实体内容([n] 引用上标、对比表、编号趋势列表);生成中=高亮边框 + 已产生行 + 光标动画;待生成=虚线灰占位;
  - 参考文献列表:编号 + 标题 + venue,与引用上标对应;
  - 底部追问输入框:直接复用 `components/features/agent/chat-input.tsx`(无数据耦合)。

内容主题沿用现有 mock 的扩散模型语境(与 deep-search 页、发现页演示数据一致),但报告更长更结构化。

## 组件拆分

新建 `components/features/deep-research/`:

| 组件 | 职责 |
|---|---|
| `deep-research-home.tsx` | 入口态全部(Hero / 输入卡 / 建议 / 历史列表),提交回调上抛 |
| `research-workbench.tsx` | session 骨架:顶条 + 双栏布局 + 左栏折叠态 |
| `plan-card.tsx` | 研究计划大纲,状态点由 props 驱动 |
| `step-timeline.tsx` | 步骤时间线(可见事件列表) |
| `source-wall.tsx` | 来源 chips 墙 |
| `report-viewer.tsx` | 报告头 + 章节(三种生成态)+ 参考文献 |
| `use-deep-research-run.ts` | 运行状态机 hook(见下节) |

页面装配:`app/agents/deep-research/page.tsx` 新建 client 页组件 `deep-research-page.tsx`(读 URL 参数、持 view 状态),page.tsx 仅做 AppShell 包裹。

共享改动:`answer-card.tsx` 内的 `withCitations` 引用上标渲染函数抽到 `lib/citations.tsx`,answer-card 与 report-viewer 两处复用(纯函数返回 ReactNode,沿用 lib 工具惯例)。

## 数据与仿真

全部 mock,确定性、无随机(跟随 auto-research 的 research-run 惯例)。

### types/index.ts 新增

```ts
export interface DRPlanSection {
  id: string;
  title: string;            // 大纲节标题,如 "1. 代表性方法与对比"
  query: string;            // 该节检索意图(计划卡内展示)
}

export interface DRSource {
  id: number;               // 引用编号 [n]
  title: string;
  venue: string;            // 如 "CoRL 2024 · Stanford"
  author: string;
  citations: string;        // 如 "引用 1.8k"
  recommended?: boolean;
}

export interface DRReportSection {
  id: string;               // 与 DRPlanSection.id 对应
  heading: string;
  paragraphs: string[];     // 含 [n] 引用标记
  table?: { caption: string; header: string[]; rows: string[][]; highlightRow?: number };
  list?: string[];          // 编号趋势列表
}

export interface DRReport {
  question: string;
  title: string;
  abstract: string;
  stats: { read: number; cited: number };   // 耗时由运行时钟显示,不进静态数据
  sections: DRReportSection[];              // 4 节
  references: DRSource[];                   // 约 15 条,编号有序,来源墙同用
}

export type DRStepKind = "search" | "read" | "analyze" | "write";

export interface DRStepEvent {
  offsetMs: number;         // 确定性时间轴
  kind: DRStepKind;
  label: string;            // 如 "检索「diffusion policy」· 32 个来源"
  sectionId?: string;       // write 类事件关联章节
}

export interface DRHistoryItem {
  id: string;
  title: string;
  status: "已完成" | "进行中";
  sources: number;
  time: string;
}
```

### lib/data/deep-research.ts

导出 `drPlan`(4 节)、`drReport`(摘要 + 4 节全文 + 约 15 条参考文献)、`drEvents`(plan_ready 由初始态表达,事件流仅含 step 事件:search×2 → read → analyze → write×4 → 末尾 done 由最后事件完成推导,总时长约 12s)、`drHistory`(4 条)。章节正文可从 `lib/data/agent.ts` 的 answerBlocks 扩写,保持术语一致。

### use-deep-research-run.ts

- 状态:`phase: "running" | "done"`、`elapsedMs`;派生:可见事件列表、各节状态;
- 节状态派生规则(计划节与报告节共用):某节的 write 事件出现 → 生成中;下一节的 write 事件出现、或事件流播完 → 前节转为已生成;尚无 write 事件的节 → 待生成;
- 机制:仅客户端 effect 内以固定间隔(100ms)tick 累加 elapsed,`visible = drEvents.filter(e => e.offsetMs <= elapsed)`;SSR 输出初始态,无水合不一致;
- 参数(在 page 层解析后传入):
  - `?autostart=1` —— 直接进 session 并从头播放(演示);
  - `?mode=instant` —— 直接进 session 完成态(headless 截图稳定);与 autostart 同时存在时 instant 优先;
  - `?q=xxx` —— 预填问题并进入 session 播放;q 为空串时停留 home 并聚焦输入框。

## 边界与错误处理

纯前端原型,无网络错误。边界:`?q=` 为空 → home 聚焦输入框;运行中点「返回」→ 停止计时器、重置回 home;组件卸载清理 interval(与 agent-chat 的定时器清理同款)。

## 验证

1. `pnpm build` 通过;
2. headless Edge 截图(shot_pages / shot_themes 惯例,`?mode=instant` 与 `?autostart=1` 分用)日/夜两态:入口态、session 进行中(autostart + 延时截)、session 完成态(instant);
3. `/agents/deep-search?q=…` 路由回归截图:内容与迁移前逐块一致。

## 非目标(YAGNI)

- 导出/分享的真实功能;后端与真实检索;
- 研究计划的真实编辑(仅展示可编辑 affordance);
- 来源墙点击跳转报告引用处(仅 hover);
- 旧路由 redirect;与 Auto Research 的联动(如报告转流水线);
- 多份真实历史会话(所有历史卡片共用一份示例报告)。
