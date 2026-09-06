import { NextResponse } from "next/server";
import { getKnowledgePaper } from "@/lib/server/knowledge-base";

export const runtime = "nodejs";

/** 服务端代理 PDF 下载，避免浏览器直接暴露知识底座地址并处理跨域。 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const paper = await getKnowledgePaper(id);
    if (!paper.pdfUrl) {
      return NextResponse.json({ success: false, error: "该论文暂无可下载 PDF" }, { status: 404 });
    }

    let pdfUrl: URL;
    try {
      pdfUrl = new URL(paper.pdfUrl);
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

    const safeName = (paper.title || id).replace(/[\\/:*?"<>|\r\n]+/g, "_").slice(0, 120);
    return new NextResponse(response.body, {
      headers: {
        "Content-Type": response.headers.get("content-type")?.includes("pdf") ? "application/pdf" : "application/octet-stream",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`${safeName}.pdf`)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: "论文 PDF 暂不可用" }, { status: 502 });
  }
}
