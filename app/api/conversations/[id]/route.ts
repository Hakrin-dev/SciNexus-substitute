/**
 * GET /api/conversations/[id]
 * 获取指定对话的完整详情（含消息列表）
 */
import { NextRequest, NextResponse } from "next/server";
import { ensureSeed, fail } from "@/lib/server/utils";
import { getDB, jsonParse } from "@/lib/server/db";
import { requireAuth } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  ensureSeed();
  const { id } = await params;
  try {
    const user = requireAuth(req);
    if (!user) return fail("请先登录", 401, "UNAUTHORIZED");
    const userId = user.id;

    const db = getDB();
    const conv = db
      .prepare("SELECT * FROM conversations WHERE id = ? AND user_id = ?")
      .get(id, userId) as any;
    if (!conv) return fail("对话未找到", 404);

    const msgs = db
      .prepare("SELECT * FROM conversation_messages WHERE conversation_id = ? ORDER BY id ASC")
      .all(id) as any[];

    return NextResponse.json({
      success: true,
      data: {
        id: conv.id,
        title: conv.title,
        preview: conv.preview,
        createdAt: conv.created_at,
        updatedAt: conv.updated_at,
        messages: msgs.map((m) => ({
          role: m.role,
          content: m.content,
          createdAt: m.created_at,
          workflow: m.workflow_json ? jsonParse(m.workflow_json, null) : null,
          references: m.references_json ? jsonParse(m.references_json, null) : null,
        })),
      },
    });
  } catch (e: any) {
    return fail(e.message || "获取对话失败");
  }
}
