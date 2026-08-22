/**
 * POST /api/translate
 * 学术文本翻译（一次性返回完整译文）
 *
 * Body: { text, target_lang?, source_lang? }
 */
import { NextRequest, NextResponse } from "next/server";
import { ensureSeed, fail, parseBody } from "@/lib/server/utils";
import { translateText } from "@/lib/server/llm";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  ensureSeed();
  try {
    const body = await parseBody<{ text: string; target_lang?: string; source_lang?: string }>(req);
    const text = (body.text || "").trim();
    if (!text) return fail("文本不能为空");
    if (text.length > 8000) return fail("文本过长");

    const target = body.target_lang || "中文";
    const translated = await translateText(text, target, body.source_lang);
    return NextResponse.json({ success: true, translated, target_lang: target });
  } catch (e: any) {
    return fail(e.message || "翻译失败");
  }
}
