/**
 * POST /api/chat/stream
 * AI 对话流式接口（SSE 逐字发送回复，多智能体编排）
 */
import { NextRequest } from "next/server";
import { ensureSeed, fail, parseBody, extractMessage, genId } from "@/lib/server/utils";
import { getDB, jsonStringify } from "@/lib/server/db";
import { requireAuth } from "@/lib/server/auth";
import { runAgent } from "@/lib/server/agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ChatReq {
  conversation_id?: string;
  message?: string;
  messages?: { role: string; content: string }[];
  task_type?: string;
  paper_id?: string;
  model?: string;
}

export async function POST(req: NextRequest) {
  ensureSeed();
  const user = requireAuth(req);
  if (!user) return fail("请先登录", 401, "UNAUTHORIZED");
  const userId = user.id;

  const body = await parseBody<ChatReq>(req);
  const msg = extractMessage(body);
  const history = body.messages?.filter(
    (item) => (item.role === "user" || item.role === "assistant") && item.content,
  ).slice(-24) ?? [];
  const result = await runAgent(msg || "你好", body.task_type, body.paper_id, history, body.model);
  const { reply, workflow, references, generatedFiles } = result;

  const conversationId = body.conversation_id || genId("conv_");

  // 异步落库（无需等待）
  (async () => {
    try {
      const db = getDB();
      const convExists = db
        .prepare("SELECT 1 FROM conversations WHERE id = ? AND user_id = ?")
        .get(conversationId, userId);
      if (!convExists) {
        db.prepare(
          "INSERT INTO conversations (id, user_id, title, preview) VALUES (?, ?, ?, ?)"
        ).run(conversationId, userId, (msg || "").slice(0, 30), (msg || "").slice(0, 80));
      }
      db.prepare(
        "INSERT INTO conversation_messages (conversation_id, role, content) VALUES (?, 'user', ?)"
      ).run(conversationId, msg || "");
      db.prepare(
        "INSERT INTO conversation_messages (conversation_id, role, content, workflow_json) VALUES (?, 'assistant', ?, ?)"
      ).run(conversationId, reply, jsonStringify(workflow));
    } catch {}
  })();

  const stream = new ReadableStream({
    async start(controller) {
      const convId = conversationId;
      const meta = {
        conversation_id: convId,
        tokens: reply.length,
        workflow,
        references,
        generated_files: generatedFiles,
      };
      controller.enqueue(
        `event: meta\ndata: ${JSON.stringify(meta)}\n\n`
      );

      const chunkSize = reply.length > 800 ? 8 : 1;
      for (let i = 0; i < reply.length; i += chunkSize) {
        const chunk = reply.slice(i, i + chunkSize);
        const payload = JSON.stringify({
          choices: [{ delta: { content: chunk } }],
        });
        controller.enqueue(`data: ${payload}\n\n`);
        await new Promise((r) => setTimeout(r, chunkSize > 1 ? 4 : 35));
      }
      controller.enqueue(`event: done\ndata: [DONE]\n\n`);
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
