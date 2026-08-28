import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ensureSeed } from "@/lib/server/utils";
import { getDB } from "@/lib/server/db";
import { PaperReaderView } from "./paper-reader-view";

interface Props {
  params: Promise<{ id: string }>;
}

interface PaperMeta {
  title: string;
  abstract: string;
  authors: string;
}

/** 查本地 SQLite 中的论文基础信息;异常/未命中返回 null */
function getLocalPaperRow(id: string): PaperMeta | null {
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

/**
 * 服务端查论文基础信息(用于元数据与 404 判定;查询失败不阻塞渲染)。
 * 本地库未命中且配置了外部后端(NEXT_PUBLIC_API_URL)时回退查后端 ——
 * 本地以 .env.local 指向 FastAPI(8000)时,首页 feed 论文来自后端(如 OpenAlex 的 W-id),
 * 若只查本地库会把真实存在的论文误判为「页面不存在」;云端部署无该配置,不走回退。
 */
async function getPaperRow(id: string): Promise<PaperMeta | null> {
  const local = getLocalPaperRow(id);
  if (local) return local;

  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(`${base}/api/papers/${encodeURIComponent(id)}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: {
        title?: string;
        abstract?: string;
        authors?: string;
        author_list?: string[];
      };
    };
    const d = json?.data;
    if (!d?.title) return null;
    return {
      title: d.title,
      abstract: d.abstract ?? "",
      authors: Array.isArray(d.author_list) ? d.author_list.join(", ") : (d.authors ?? ""),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const paper = await getPaperRow(id);
  if (!paper) {
    // 在流式开始前触发 404(此处调用可携带正确的 HTTP 状态码)
    notFound();
  }
  return {
    title: `${paper.title} | 研枢 SciNexus`,
    description: paper.abstract.slice(0, 160),
    openGraph: { title: paper.title, description: paper.abstract.slice(0, 160) },
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
