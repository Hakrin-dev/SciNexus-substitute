import { NextResponse } from "next/server";
import { findKnowledgePaperByTitle, getKnowledgePaper, KnowledgeBaseError, shouldUseRemoteKnowledgeBase } from "@/lib/server/knowledge-base";
import { ensureSeed } from "@/lib/server/utils";
import { getDB } from "@/lib/server/db";
import { fetchSafePdf } from "@/lib/server/pdf-proxy";

export const runtime = "nodejs";

/** 服务端代理 PDF 下载，避免浏览器直接暴露知识底座地址并处理跨域。 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    ensureSeed();
    // The local schema does not require a pdf_url column. Read defensively so
    // remote papers can still be resolved by source/title.
    const local = getDB().prepare("SELECT * FROM papers WHERE id = ?").get(id) as { title?: string; pdf_url?: string | null } | undefined;
    const requestUrl = new URL(req.url);
    const preferRemote = requestUrl.searchParams.get("source") === "remote_knowledge_base";
    const requestedTitle = requestUrl.searchParams.get("title")?.trim();
    let remote: Awaited<ReturnType<typeof getKnowledgePaper>> | null = null;
    if (preferRemote || (!local && shouldUseRemoteKnowledgeBase())) {
      try {
        remote = await getKnowledgePaper(id);
      } catch (error) {
        if (!requestedTitle) throw error;
        remote = await findKnowledgePaperByTitle(requestedTitle);
      }
    }
    const title = preferRemote ? remote?.title || id : local?.title || remote?.title || id;
    const sourceUrl = preferRemote ? remote?.pdfUrl : local?.pdf_url || remote?.pdfUrl;
    if (!sourceUrl) {
      return NextResponse.json({ success: false, error: "该论文暂无可下载 PDF" }, { status: 404 });
    }

    const response = await fetchSafePdf(sourceUrl);

    const safeName = title.replace(/[\\/:*?"<>|\r\n]+/g, "_").slice(0, 120);
    const inline = new URL(req.url).searchParams.get("inline") === "1";
    return new NextResponse(response.body, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(`${safeName}.pdf`)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.warn("[scinexus] PDF proxy failed", error instanceof KnowledgeBaseError ? error.code : error instanceof Error ? error.name : typeof error);
    const status = error instanceof KnowledgeBaseError ? error.status ?? 502 : 502;
    const message = error instanceof KnowledgeBaseError ? error.message : "论文 PDF 暂不可用";
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
