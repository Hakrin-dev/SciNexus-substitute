import { NextResponse } from "next/server";
import { getKnowledgePaper } from "@/lib/server/knowledge-base";
import { ensureSeed } from "@/lib/server/utils";
import { getDB } from "@/lib/server/db";

export const runtime = "nodejs";

/** 服务端代理 PDF 下载，避免浏览器直接暴露知识底座地址并处理跨域。 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    ensureSeed();
    const local = getDB().prepare("SELECT title, pdf_url FROM papers WHERE id = ?").get(id) as { title?: string; pdf_url?: string | null } | undefined;
    const remote = local ? null : await getKnowledgePaper(id);
    const title = local?.title || remote?.title || id;
    const sourceUrl = local?.pdf_url || remote?.pdfUrl;
    if (!sourceUrl) {
      return NextResponse.json({ success: false, error: "该论文暂无可下载 PDF" }, { status: 404 });
    }

    let pdfUrl: URL;
    try {
      pdfUrl = new URL(sourceUrl);
    } catch {
      return NextResponse.json({ success: false, error: "论文 PDF 地址无效" }, { status: 502 });
    }
    if (!["http:", "https:"].includes(pdfUrl.protocol)) {
      return NextResponse.json({ success: false, error: "论文 PDF 地址协议不受支持" }, { status: 502 });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    let response: Response;
    try {
      response = await fetch(pdfUrl, { signal: controller.signal, cache: "no-store" });
    } finally {
      clearTimeout(timer);
    }
    if (!response.ok || !response.body) {
      return NextResponse.json({ success: false, error: "论文 PDF 暂不可用" }, { status: 502 });
    }

    const safeName = title.replace(/[\\/:*?"<>|\r\n]+/g, "_").slice(0, 120);
    const inline = new URL(req.url).searchParams.get("inline") === "1";
    return new NextResponse(response.body, {
      headers: {
        "Content-Type": response.headers.get("content-type")?.includes("pdf") ? "application/pdf" : "application/octet-stream",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(`${safeName}.pdf`)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: "论文 PDF 暂不可用" }, { status: 502 });
  }
}
