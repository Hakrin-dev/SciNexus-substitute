import Link from "next/link";
import {
  ArrowRight,
  Award,
  Banknote,
  BookOpen,
  Building2,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { patents } from "@/lib/data/patents";
import { fundings } from "@/lib/data/funding";
import { scholars } from "@/lib/data/scholars";
import { institutions } from "@/lib/data/institutions";

const SECTIONS = [
  {
    href: "/knowledge/papers",
    label: "论文库",
    icon: BookOpen,
    description: "我的文献库:私有论文与收藏文献的文件夹与标签管理",
    stat: "在读 12 篇",
  },
  {
    href: "/knowledge/patents",
    label: "专利库",
    icon: Award,
    description: "AI 领域专利检索,按技术领域与法律状态浏览",
    stat: `${patents.length} 件专利`,
  },
  {
    href: "/knowledge/funding",
    label: "项目基金库",
    icon: Banknote,
    description: "国自然、重点研发计划等资助项目的金额与进展",
    stat: `${fundings.length} 个项目`,
  },
  {
    href: "/knowledge/scholars",
    label: "学者关系",
    icon: Users,
    description: "从合作网络与引用脉络中发现关键学者",
    stat: `${scholars.length} 位学者`,
  },
  {
    href: "/knowledge/institutions",
    label: "研究机构",
    icon: Building2,
    description: "全球顶尖高校、研究院与企业实验室的详细画像",
    stat: `${institutions.length} 家机构`,
  },
];

/** 知识库导航页 `/knowledge` —— 五个子栏目的入口 */
export default function KnowledgePage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-[960px] px-8 py-10">
        <h1 className="text-xl font-bold text-ink">知识库</h1>
        <p className="mt-1 text-sm text-muted">
          论文、专利、基金、学者与机构,一站触达
        </p>

        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {SECTIONS.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="group rounded-2xl bg-card p-6 shadow-card transition-shadow hover:shadow-pop"
            >
              <div className="flex items-center justify-between">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-primary-soft">
                  <section.icon className="size-6 text-primary" />
                </span>
                <ArrowRight className="size-4 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </div>
              <h2 className="mt-4 text-[15px] font-bold text-ink">
                {section.label}
              </h2>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
                {section.description}
              </p>
              <p className="mt-3 text-xs text-faint">{section.stat}</p>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
