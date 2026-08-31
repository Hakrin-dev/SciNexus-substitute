import type { Metadata } from "next";
import { PaperReaderView } from "./paper-reader-view";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return {
    // 远程知识底座使用 paper:* ID，不能用本地 SQLite 的存在性提前判 404。
    title: `论文阅读 | 研枢 SciNexus`,
    description: `论文 ${id} 的阅读与知识图谱页面。`,
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
