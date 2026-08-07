# 知识库子页面完善设计:专利库 / 项目基金库 / 研究机构

日期:2026-08-07
状态:已获用户批准(方案 A)

## 背景

`/knowledge/patents`、`/knowledge/funding`、`/knowledge/institutions` 三个路由目前均为 `KnowledgeStub` 占位。本设计将其补完为正式页面:

- patents / funding:布局参考论文库 `/knowledge`(左侧面板 + 右侧表格两栏)
- institutions:参考学者关系页 `/knowledge/scholars` 的卡片,但做成单列大卡片、介绍更详细

项目无后端,全部为 `lib/data/*.ts` mock 数据;组件手写 shadcn 风格;交互用 client 组件 + useState。

## 实现方式:方案 A(平行组件)

为三个页面各建独立组件与 mock 数据文件,不改动已验收的 `/knowledge`、`/knowledge/scholars` 代码,不做跨页抽象。

## 类型(types/index.ts 新增)

```ts
export interface Patent {
  id: string;
  title: string;          // 专利名称
  applicationNo: string;  // 申请号,如 CN202410123456.7
  applicant: string;      // 申请人
  publishedAt: string;    // 公开日,如 2025-03-14
  field: string;          // 技术领域(用于左栏筛选)
  status: "已授权" | "实质审查" | "已公开" | "PCT";
  kind: "发明" | "实用新型";
  citations: number;      // 被引次数(排序用)
}

export interface Funding {
  id: string;
  title: string;          // 项目名称
  grantNo: string;        // 批准号
  pi: string;             // 负责人
  institution: string;    // 依托单位
  amount: string;         // 资助金额,如 300 万元
  period: string;         // 起止年限,如 2024-01 ~ 2027-12
  category: string;       // 资助类别(用于左栏筛选)
  status: "在研" | "结题";
}

export interface Institution {
  id: string;
  nameCn: string;
  nameEn: string;
  initials: string;       // logo 色块字母,如 THU
  logoColor: string;
  type: "高校" | "研究院" | "企业实验室";
  location: string;
  intro: string;          // 4 行左右详细介绍:历史、学科优势、代表平台
  stats: { label: string; value: string }[];  // 4 项:研究人员/年论文/总引用/国家级平台
  fields: string[];       // 优势方向 tags
  highlight: string;      // 代表性成果一句话
  followed?: boolean;
}
```

## 页面 1:专利库 `/knowledge/patents`

完整两栏,骨架对齐 `/knowledge`:

- **左栏 `PatentPanel`**(client):标题"专利库";技术领域列表(机器学习 / 自然语言处理 / 计算机视觉 / 智能机器人 / 芯片与系统,各带数量徽标,点击筛选,选中态样式同 LibraryPanel 的 active);法律状态 chips(已授权 / 实质审查 / 已公开 / PCT 国际申请,用 LibraryPanel 的 TAG_COLORS 配色)
- **右栏 `PatentTable`**:头部"共 N 件专利 · 上次更新 8 月 1 日";表格列:专利名称(+申请号副行)/ 申请人 / 公开日;行首为"发明/实用新型"徽章(复用 PDF_TONES 色调);排序按钮组:最新公开 / 被引最多
- 筛选与搜索:右栏顶部搜索框(复用 `useDebounce`,300ms)按名称/申请号/申请人过滤;左栏领域筛选与搜索可叠加
- 组件文件:`components/features/knowledge/patent-panel.tsx`、`patent-table.tsx`(外加一个 client 容器 `patents-browser.tsx` 持有筛选状态)
- 数据:`lib/data/patents.ts`,约 10 条 AI 领域专利

## 页面 2:项目基金库 `/knowledge/funding`

与专利库同款两栏:

- **左栏 `FundingPanel`**:资助类别(国家自然科学基金 / 国家重点研发计划 / 省市项目 / 企业横向,带数量徽标可筛选);项目状态 chips(在研 / 结题)
- **右栏 `FundingTable`**:列:项目名称(+批准号副行)/ 负责人 · 依托单位 / 资助金额 / 起止年限;状态徽章(在研=绿色 success-soft,结题=灰 chip);搜索框按名称/批准号/负责人过滤
- 组件文件:`funding-panel.tsx`、`funding-table.tsx`、`funding-browser.tsx`
- 数据:`lib/data/funding.ts`,约 10 条

## 页面 3:研究机构 `/knowledge/institutions`

骨架复用 scholars 页(顶部横幅 + 搜索 + 排序 + 卡片流),但卡片放大为单列:

- **布局**:`max-w-[900px]` 单列,间距 gap-6
- **横幅**:icon + "研究机构图谱"文案 + 右侧按钮(同 ScholarsBrowser 横幅样式)
- **排序 chips**:综合排名 / 论文数 / 已关注
- **`InstitutionCard`**(client,framer-motion 入场动画同 ScholarCard):
  - 顶部:size-20 圆角方形 logo 色块(initials)+ 中英文名 + 类型徽章 + 所在地 + 关注按钮(复用 `FollowButton`,zustand persist 已有 scholar 维度,机构用同一 store 加前缀 key)
  - 简介:`intro`,约 4 行,不用 line-clamp(卡片即详情)
  - 统计行:4 项加粗数字(研究人员 / 年论文 / 总引用 / 国家级平台),比学者卡片 2 项更丰富
  - 底部:优势方向 tags + 代表性成果一行(高亮图标 + 文字)
- 点击不跳转(卡片即详情,无详情路由)
- 组件文件:`components/features/institution/institution-card.tsx`、`institutions-browser.tsx`(筛选/搜索/排序逻辑)
- 数据:`lib/data/institutions.ts`,约 8 家:清华大学、中科院计算所、北京大学、MIT CSAIL、Stanford SAIL、Google DeepMind、OpenAI、Mila

## FollowButton 复用检查

`FollowButton` 当前签名 `scholarId: string`。机构关注复用同一 zustand store,key 加 `inst:` 前缀避免与学者 id 冲突;若组件命名过窄,做一个薄封装 `InstitutionFollowButton` 传入带前缀 id,不改动原组件。

## 文件清单

新增:

- `lib/data/patents.ts`、`lib/data/funding.ts`、`lib/data/institutions.ts`
- `components/features/knowledge/patents-browser.tsx`、`patent-panel.tsx`、`patent-table.tsx`
- `components/features/knowledge/funding-browser.tsx`、`funding-panel.tsx`、`funding-table.tsx`
- `components/features/institution/institution-card.tsx`、`institutions-browser.tsx`

修改:

- `types/index.ts`(新增 Patent / Funding / Institution)
- `app/knowledge/patents/page.tsx`、`app/knowledge/funding/page.tsx`、`app/knowledge/institutions/page.tsx`(替换 stub)

## 验证

1. `pnpm build` 通过(无 TS / lint 错误)
2. dev server 下三个页面 headless Edge 截图人工核验(含日夜间模式,沿用项目既有验证流程)
