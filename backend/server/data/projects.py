"""科研项目 mock 数据 —— 内容对齐前端 lib/data/projects.ts。"""

PROJECTS = [
    {
        "id": "scinexus",
        "name": "研枢",
        "tagline": "SciNexus —— 面向 AI 领域的个性化自主科研知识智能体平台",
        "status": "进行中",
        "progress": 68,
        "createdAt": "2025-11-02",
        "owner": "Hakrin-dev",
        "overview": [
            "研枢提供论文检索、投稿筛选与 AI 深度搜索服务。前端为 prototype_v1 SVG 原型的正式 React 实现,并落地了品牌体系与日/夜模式。",
            "基于 Next.js 16 + React 19 构建,支持 Docker 容器化部署与 GitHub Actions CI/CD。",
        ],
        "techStack": [
            "Next.js 16",
            "React 19",
            "TypeScript",
            "Tailwind CSS 4",
            "TanStack Query",
            "Zustand",
            "Framer Motion",
            "Docker",
        ],
        "milestones": [
            {"title": "原型页面转换", "detail": "7 张 SVG 原型 + 2 个知识图谱页,9 个路由全部完成", "status": "done"},
            {"title": "品牌体系落地", "detail": "书法 Logo 日/夜双版 + 「深识」配色令牌,日夜间模式", "status": "done"},
            {"title": "部署上线", "detail": "阿里云 ECS + GitHub Actions CI/CD,push 即发布", "status": "done"},
            {"title": "设置与用户体系界面", "detail": "设置页七 Tab、登录弹窗、个人学者画像(演示态)", "status": "doing"},
            {"title": "接入真实数据层", "detail": "Server Actions + 数据库替换 mock;认证(NextAuth)", "status": "todo"},
            {"title": "编辑器与可视化", "detail": "TipTap 文档编辑、D3.js 图谱交互增强", "status": "todo"},
        ],
        "members": [
            {"name": "Hakrin-dev", "role": "负责人"},
            {"name": "陈研", "role": "前端"},
            {"name": "李识", "role": "算法"},
        ],
        "links": [
            {"label": "GitHub 仓库", "href": "https://github.com/Hakrin-dev/SciNexus-substitute"},
            {"label": "GHCR 镜像", "href": "https://ghcr.io/Hakrin-dev/SciNexus-substitute"},
        ],
    },
]


def get_project(project_id: str) -> dict:
    """按 id 取项目；未命中回退第一个（与前端 getProject 行为一致）。"""
    for p in PROJECTS:
        if p["id"] == project_id:
            return p
    return PROJECTS[0]
