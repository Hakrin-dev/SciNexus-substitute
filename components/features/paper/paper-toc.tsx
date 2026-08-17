import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PaperDetail } from "@/types";

/** 左侧目录栏 —— 本文摘要 TOC(对应论文详情页 SVG 左栏) */
export function PaperToc({ toc }: { toc: PaperDetail["toc"] }) {
  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r border-line bg-card p-4 lg:flex">
      <Logo />
      <Link href="/knowledge" className="mt-5 block">
        <Button variant="outline" size="sm" className="w-full justify-start rounded-lg">
          <ArrowLeft className="size-3.5" />
          返回知识库
        </Button>
      </Link>

      <p className="mt-6 text-xs text-faint">本文摘要</p>
      <nav className="mt-2 space-y-0.5">
        {toc.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            aria-current={item.active ? "true" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors",
              item.active
                ? "border-l-2 border-primary bg-primary-soft/50 font-medium text-primary"
                : "text-muted hover:bg-chip hover:text-ink-2",
            )}
          >
            <span className="size-1 shrink-0 rounded-full bg-current opacity-60" />
            {item.label}
          </a>
        ))}
      </nav>
    </aside>
  );
}
