import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ensureSeed } from "@/lib/server/utils";
import { getDB } from "@/lib/server/db";
import { PaperReaderView } from "./paper-reader-view";

interface Props {
  params: Promise<{ id: string }>;
}

/** 服务端查论文基础信息(用于元数据与 404 判定;查询失败不阻塞渲染) */
function getPaperRow(id: string): { title: string; abstract: string; authors: string } | null {
  try {
    ensureSeed();
    const db = getDB();
    const row = db
      .prepare("SELECT title, abstract, authors FROM papers WHERE id = ?")
      .get(id) as { title: string; abstract: string; authors: string } | undefined;
    if (!row) return null;
    return {
      title: row.title ?? "",
      abstract: row.abstract ?? "",
      authors: row.authors ?? "",
    };
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const paper = getPaperRow(id);
  if (!paper) {
    // 在流式开始前触发 404(此处调用可携带正确的 HTTP 状态码)
    notFound();
  }
  return {
    title: `${paper!.title} | 研枢 SciNexus`,
    description: paper!.abstract.slice(0, 160),
    openGraph: { title: paper!.title, description: paper!.abstract.slice(0, 160) },
  };
}

/**
 * 论文详情页 `/papers/[id]` —— Server 壳:
 * 负责 metadata / 404 判定,阅读器交互体在 PaperReaderView(客户端)。
 */
export default async function PaperDetailPage({ params }: Props) {
  const { id } = await params;
  return <PaperReaderView id={id} />;
}
