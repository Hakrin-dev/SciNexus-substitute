/**
 * POST /api/chat
 * AI 对话（多智能体编排，一次性返回完整回复）
 *
 * Body: {
 *   conversation_id?: string,
 *   message?: string,
 *   messages?: { role, content }[],
 *   task_type?: string,
 *   paper_id?: string
 * }
 */
import { NextRequest } from "next/server";
import { ensureSeed, fail, ok, parseBody, extractMessage } from "@/lib/server/utils";
import { getDB, jsonStringify } from "@/lib/server/db";
import { requireAuth } from "@/lib/server/auth";
import { genId } from "@/lib/server/utils";
import { runAgent } from "@/lib/server/agent";

export const runtime = "nodejs";

interface ChatReq {
  conversation_id?: string;
  message?: string;
  messages?: { role: string; content: string }[];
  task_type?: string;
  paper_id?: string;
  model?: "默认" | "订阅" | "API接入";
}

/** 从 messages 中提取多轮历史（排除最后一条用户消息），最多保留最近 24 条 */
function chatHistory(body: ChatReq): { role: string; content: string }[] {
  const messages = body.messages || [];
  let lastUser = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user" && messages[i].content) {
      lastUser = i;
      break;
    }
  }
  if (lastUser < 0) return [];
  return messages
    .slice(0, lastUser)
    .filter((m) => (m.role === "user" || m.role === "assistant" || m.role === "system") && m.content)
    .map((m) => ({ role: m.role, content: m.content }))
    .slice(-24);
}

export async function POST(req: NextRequest) {
  ensureSeed();
  try {
    const user = requireAuth(req);
    if (!user) return fail("请先登录", 401, "UNAUTHORIZED");
    const userId = user.id;
    const body = await parseBody<ChatReq>(req);
    const msg = extractMessage(body);
    if (!msg) return fail("消息不能为空");

    const db = getDB();
    const conversationId = body.conversation_id || genId("conv_");

    // 创建或更新对话
    const convExists = db
      .prepare("SELECT 1 FROM conversations WHERE id = ? AND user_id = ?")
      .get(conversationId, userId);
    if (!convExists) {
      db.prepare(
        "INSERT INTO conversations (id, user_id, title, preview) VALUES (?, ?, ?, ?)"
      ).run(conversationId, userId, msg.slice(0, 30), msg.slice(0, 80));
    } else {
      db.prepare(
        "UPDATE conversations SET preview = ?, updated_at = datetime('now','localtime') WHERE id = ? AND user_id = ?"
      ).run(msg.slice(0, 80), conversationId, userId);
    }

    // 写入用户消息
    db.prepare(
      "INSERT INTO conversation_messages (conversation_id, role, content) VALUES (?, 'user', ?)"
    ).run(conversationId, msg);

    // 多智能体编排生成回复
    const result = await runAgent(msg, body.task_type, body.paper_id, chatHistory(body), body.model);
    const { reply, workflow, references, generatedFiles } = result;

    // 写入 AI 消息
    db.prepare(
      "INSERT INTO conversation_messages (conversation_id, role, content, workflow_json) VALUES (?, 'assistant', ?, ?)"
    ).run(conversationId, reply, jsonStringify(workflow));

    return ok({
      reply,
      conversation_id: conversationId,
      tokens: reply.length,
      workflow,
      references,
      generated_files: generatedFiles,
    });
  } catch (e: any) {
    return fail(e.message || "对话失败");
  }
}
