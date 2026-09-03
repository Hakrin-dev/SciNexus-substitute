/** 科研项目 mock 数据。 */

export type MilestoneStatus = "done" | "doing" | "todo";

export interface Milestone {
  title: string;
  detail: string;
  status: MilestoneStatus;
}

export interface Project {
  id: string;
  name: string;
  tagline: string;
  status: "进行中" | "已完成" | "已搁置";
  progress: number;
  createdAt: string;
  owner: string;
  overview: string[];
  techStack: string[];
  milestones: Milestone[];
  members: { name: string; role: string }[];
  links: { label: string; href: string }[];
  /** 公共示例项目对非所有者只读。 */
  readOnly?: boolean;
}

export const projects: Project[] = [
  {
    id: "scinexus",
    name: "多智能体综述的引用可靠性研究",
    tagline: "从论断提取、证据聚类到引用校验的完整自动研究示例",
    status: "进行中",
    progress: 68,
    createdAt: "2025-11-02",
    owner: "Hakrin-dev",
    overview: [
      "研枢提供论文检索、投稿筛选与 AI 深度搜索服务。前端为 prototype_v1 SVG 原型的正式 React 实现,并落地了品牌体系与日/夜模式。",
      "基于 Next.js 16 + React 19 构建,支持 Docker 容器化部署与 GitHub Actions CI/CD。",
    ],
    techStack: [
      "Next.js 16",
      "React 19",
      "TypeScript",
      "Tailwind CSS 4",
      "TanStack Query",
      "Zustand",
      "Framer Motion",
      "Docker",
    ],
    milestones: [
      {
        title: "原型页面转换",
        detail: "7 张 SVG 原型 + 2 个知识图谱页,9 个路由全部完成",
        status: "done",
      },
      {
        title: "品牌体系落地",
        detail: "书法 Logo 日/夜双版 + 「深识」配色令牌,日夜间模式",
        status: "done",
      },
      {
        title: "部署上线",
        detail: "阿里云 ECS + GitHub Actions CI/CD,push 即发布",
        status: "done",
      },
      {
        title: "设置与用户体系界面",
        detail: "设置页七 Tab、登录弹窗、个人学者画像(演示态)",
        status: "doing",
      },
      {
        title: "接入真实数据层",
        detail: "Server Actions + 数据库替换 mock;认证(NextAuth)",
        status: "todo",
      },
      {
        title: "编辑器与可视化",
        detail: "TipTap 文档编辑、D3.js 图谱交互增强",
        status: "todo",
      },
    ],
    members: [
      { name: "Hakrin-dev", role: "负责人" },
      { name: "陈研", role: "前端" },
      { name: "李识", role: "算法" },
    ],
    links: [
      { label: "GitHub 仓库", href: "https://github.com/Hakrin-dev/SciNexus-substitute" },
      { label: "GHCR 镜像", href: "https://ghcr.io/Hakrin-dev/SciNexus-substitute" },
    ],
  },
];

export function getProject(id: string): Project {
  return projects.find((p) => p.id === id) ?? projects[0];
}
