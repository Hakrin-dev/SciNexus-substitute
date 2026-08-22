/**
 * POST /api/translate/stream
 * 学术文本翻译流式接口（SSE 分块发送译文）
 */
import { NextRequest } from "next/server";
import { ensureSeed, fail, parseBody } from "@/lib/server/utils";
import { translateText } from "@/lib/server/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  ensureSeed();
  try {
    const body = await parseBody<{ text: string; target_lang?: string; source_lang?: string }>(req);
    const text = (body.text || "").trim();
    if (!text) return fail("文本不能为空");
    if (text.length > 8000) return fail("文本过长");

    const target = body.target_lang || "中文";
    const translated = await translateText(text, target, body.source_lang);

    const stream = new ReadableStream({
      async start(controller) {
        const meta = { target_lang: target, tokens: translated.length };
        controller.enqueue(`event: meta\ndata: ${JSON.stringify(meta)}\n\n`);

        const chunkSize = translated.length > 800 ? 12 : 1;
        for (let i = 0; i < translated.length; i += chunkSize) {
          const chunk = translated.slice(i, i + chunkSize);
          const payload = JSON.stringify({ choices: [{ delta: { content: chunk } }] });
          controller.enqueue(`data: ${payload}\n\n`);
          await new Promise((r) => setTimeout(r, chunkSize > 1 ? 6 : 35));
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
  } catch (e: any) {
    return fail(e.message || "翻译失败");
  }
}
