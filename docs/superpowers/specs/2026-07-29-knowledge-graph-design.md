# 知识图谱(公域 + 私域)设计规范

> 日期:2026-07-29 · 状态:已批准,待实现
> 参考:`prototype_v1/知识图谱样页.png`(Research Rabbit 风格三栏:左关联论文 / 中气泡图谱 / 右摘要)

## 一、需求概述

1. **公域图谱**:论文详情页右栏 Similar 面板在「相似论文」「领域相关作者」之外新增「知识图谱」入口,点击进入图谱页 —— 左栏关联论文、中间为其他论文对本文的关系图谱(圆圈大小 = 关系强弱权重,节点以**一作姓 + 发表年份**命名)、右栏论文摘要。
2. **私域图谱**:知识库页中间栏在「文件夹」「标签」之外新增「私域知识图谱」入口,点击进入同构图谱页 —— 节点以**论文关键词 + 发表年份**命名;**「我的发表」与「文件夹论文」不在同一分层,且节点颜色不同**。

## 二、路由与入口

| 图谱 | 路由 | 布局 | 入口 |
|---|---|---|---|
| 公域 | `/papers/[id]/graph` | 沉浸式全屏(不用 AppShell,同论文阅读器) | `right-panel.tsx` Similar tab 第三节入口卡(示意图 + “查看引用关系图谱 →”) |
| 私域 | `/knowledge/graph` | AppShell(保留侧边栏) | `library-panel.tsx` 文件夹与标签之下新增入口卡(“查看私域图谱 →”) |

## 三、数据

类型定义放入 `types/index.ts`(与现有 Paper/Scholar 类型同处),mock 数据在 `lib/data/knowledge-graph.ts`:

```ts
export interface GraphNode {
  id: string;
  label: string;              // 公域 "Liu, 2024";私域 "扩散策略, 2024"
  labelLines: [string, string]; // 圆下两行标签(名 / 年份)
  weight: number;             // 0~1,关系强度 → 圆半径与透明度
  year: number;
  title: string;              // 左栏列表与右栏标题
  authors: string;
  venue: string;
  citations: string;
  abstract: string;           // 右栏摘要
  paperId?: string;           // 右栏「查看论文详情」跳转 /papers/[paperId]
  layer?: "mine" | "folder";  // 私域分层
}
export interface GraphEdge { source: string; target: string; strength: number; crossLayer?: boolean }
export interface PaperGraph {
  origin: GraphNode;
  nodes: GraphNode[];
  edges: GraphEdge[];
  relatedIds: string[];       // 左栏列表顺序
}
```

- **publicGraph**:origin = "Liu, 2024"(RDT-1B);14 节点复用 AI 助手页文献宇宙:Chi 2023(Diffusion Policy)、Ze 2024(DP3)、Kim 2024(OpenVLA)、Team 2024(Octo)、Brohan 2023(RT-2)、Wen 2026(DexMamba)、Vaswani 2017(Transformer)、Ho 2020(DDPM)、Song 2021(Score-based)、Khatsur 2024(DROID)、Fu 2024(Mobile ALOHA)、Black 2024(π0)、Zhao 2023(ALOHA)、Reed 2022(Gato);权重 0.3~1.0;边以 origin→node 为主 + 少量 node↔node。
- **privateGraph**:origin = 最新「我的发表」节点;mine 3 篇(关键词+年份标签,如「扩散策略, 2025」)、folder 9 篇(由 libraryItems 扩充,含 abstract 字段);层内实线边,跨层虚线边(crossLayer=true,表示收藏/被引关系)。

## 四、图谱视觉(共用 GraphCanvas,纯 SVG,viewBox 1000×700)

- **节点**:r = 16 + weight×30(origin 固定 46);label 两行置于圆下,12px;填充用 CSS 变量,`fill-opacity = 0.55 + weight×0.45`;夜间模式经令牌自动调浅。
- **公域布局(同心环)**:origin 居中 (500, 350);其余按权重三环 —— 内环 weight>0.66 r≈180、中环 0.4~0.66 r≈300、外环 <0.4 r≈430;环内均匀角分布 + `hash(id)` 确定性抖动(±12°、±20px)防重叠。
- **私域布局(双层带)**:上带 y≈180「我的发表」填充 `var(--color-primary)`;下带 y≈520「收藏论文」填充 `var(--color-brand-cyan)`;层带名标注于画布左缘(“我的发表 · 3”/“收藏论文 · 9”);层内权重越大越靠近画布中轴,向两侧展开。私域无中心辐射结构,`origin` 仅作为右栏默认选中项(最新的我的发表论文)。
- **边**:stroke `var(--color-line)`,宽 1 + strength×1.5;跨层边 `stroke-dasharray="5 4"`;与选中节点相连的边变 `var(--color-primary)` 且 +1px。
- **选中态**:`var(--color-brand-violet)` 3px 描边环(参照样页紫圈)+ fill-opacity 1。
- **图例**:画布底部居中 —— 公域“圆圈大小 = 与原文关系强度”;私域两色点(我的发表 / 收藏论文)+ “虚线 = 跨层关联”。
- **hover**:邻边加粗、无关节点 opacity 0.35。

## 五、三栏页面(共用 GraphPageLayout)

- **顶栏**:← 返回(公域回 `/papers/[id]`,私域回 `/knowledge`)+ 标题(公域 = 原文标题;私域 = “私域知识图谱”);公域页右侧放 Prior works / Derivative works 静态样式切换(还原样页外观,mock 不切数据)。
- **左栏 280px**:Origin paper 卡置顶(样页同款强调样式)+ 关联论文列表(标题 / 作者 / 年份);点击列表项 = 选中对应节点,选中项 `bg-primary-soft`。
- **中栏**:GraphCanvas(Framer Motion 节点 scale stagger 入场)。
- **右栏 320px**:摘要卡 —— 标题 / 作者 / 会议 / 引用数 / 摘要全文 + “查看论文详情 →”(`paperId` 存在时);默认显示 origin,点击节点切换,点画布空白回到 origin。
- **状态**:选中 nodeId 为 GraphPageLayout 内 useState,不进 URL。

## 六、文件清单

| 文件 | 职责 |
|---|---|
| `types/index.ts`(追加) | GraphNode / GraphEdge / PaperGraph 类型 |
| `lib/data/knowledge-graph.ts` | publicGraph / privateGraph mock |
| `lib/graph-layout.ts` | 纯函数:`concentricLayout()` / `strataLayout()` → `Map<id,{x,y,r}>`;`hash()` 抖动 |
| `components/features/graph/graph-canvas.tsx` | SVG 画布:边/节点/标签/图例,hover & select 回调 |
| `components/features/graph/graph-page-layout.tsx` | 三栏骨架 + 选中状态 |
| `components/features/graph/related-paper-list.tsx` | 左栏(origin 卡 + 列表) |
| `components/features/graph/node-abstract-card.tsx` | 右栏摘要卡 |
| `app/papers/[id]/graph/page.tsx` | 公域页(沉浸式) |
| `app/knowledge/graph/page.tsx` | 私域页(AppShell) |
| 改动 `components/features/paper/right-panel.tsx` | Similar tab 加公域入口卡 |
| 改动 `components/features/knowledge/library-panel.tsx` | 加私域入口卡 |

组件接口:
- `GraphCanvas({ graph, layout, selectedId, onSelect })` —— layout 由调用方按图谱类型选择,canvas 不关心布局算法。
- `GraphPageLayout({ graph, layout, backHref, title, headerExtra? })`。

## 七、错误与边界

- 节点摘要缺失时右栏只显示元信息,不渲染空摘要段。
- `paperId` 缺失的节点不显示“查看论文详情”链接。
- 小屏(<lg):左/右栏转为中栏上下的堆叠区块(图谱优先,与全站 lg 断点策略一致)。

## 八、验证

1. `pnpm build` 通过(新增 2 路由)。
2. 生产服务器 + Edge headless 截图:两图谱页日/夜各一张(`?theme=dark`),检查节点可辨、层带分色、图例正确;动画伪影以 SSR HTML 内容为准(grep 节点标签)。
3. 交互手测:入口卡跳转、点节点换摘要、点空白回 origin、左右栏联动选中。
