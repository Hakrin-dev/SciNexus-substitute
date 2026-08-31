/** GET /api/knowledge/metadata?kind=venues|tracks|categories|conferences */
import { NextRequest, NextResponse } from "next/server";
import { getKnowledgeMetadata, shouldUseRemoteKnowledgeBase } from "@/lib/server/knowledge-base";

export const runtime = "nodejs";

const kinds = new Set(["venues", "tracks", "categories", "conferences"]);

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") ?? "";
  if (!kinds.has(kind)) {
    return NextResponse.json({ success: false, error: "不支持的元数据类型" }, { status: 400 });
  }
  if (!shouldUseRemoteKnowledgeBase()) {
    return NextResponse.json({ success: false, error: "当前检索 provider 未启用远程知识底座" }, { status: 503 });
  }
  try {
    const data = await getKnowledgeMetadata(
      kind as "venues" | "tracks" | "categories" | "conferences",
      url.searchParams.get("conference") ?? undefined,
    );
    return NextResponse.json({ success: true, data, source: "remote_knowledge_base" });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "知识底座元数据暂不可用" },
      { status: 503 },
    );
  }
}
