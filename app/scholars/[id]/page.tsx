import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ensureSeed } from "@/lib/server/utils";
import { getDB } from "@/lib/server/db";
import { ScholarDetailView } from "./scholar-detail-view";

interface Props {
  params: Promise<{ id: string }>;
}

/** 服务端查学者基础信息(用于元数据与 404 判定;查询失败不阻塞渲染) */
function getScholarRow(id: string):
  | { nameCn: string; nameEn: string; affiliation: string; role: string }
  | null {
  try {
    ensureSeed();
    const db = getDB();
    const row = db
      .prepare("SELECT name_cn, name_en, affiliation, role FROM scholars WHERE id = ?")
      .get(id) as
      | { name_cn: string; name_en: string; affiliation: string; role: string }
      | undefined;
    if (!row) return null;
    return {
      nameCn: row.name_cn,
      nameEn: row.name_en,
      affiliation: row.affiliation ?? "",
      role: row.role ?? "",
    };
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const scholar = getScholarRow(id);
  if (!scholar) {
    // 在流式开始前触发 404(此处调用可携带正确的 HTTP 状态码)
    notFound();
  }
  const title = `${scholar!.nameCn} · ${scholar!.nameEn}`;
  return {
    title: `${title} | 研枢 SciNexus`,
    description: `${scholar!.role ? `${scholar!.role} · ` : ""}${scholar!.affiliation}`,
    openGraph: { title, description: scholar!.affiliation },
  };
}

/**
 * 学者详情页 `/scholars/[id]` —— Server 壳:
 * 负责 metadata / 404 判定,交互体在 ScholarDetailView(客户端)。
 */
export default async function ScholarDetailPage({ params }: Props) {
  const { id } = await params;
  return <ScholarDetailView id={id} />;
}
