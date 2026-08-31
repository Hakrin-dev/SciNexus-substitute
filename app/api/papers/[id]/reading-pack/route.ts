/**
 * GET /api/papers/[id]/reading-pack?lang=zh
 * 精读包：对照翻译段落 + 图表解读（按 paper+lang 全局缓存，首次访问生成）。
 *
 * 生成策略（P0）:
 *   - 英文原文来自本地库摘要（与 fulltext 端点同源）；无文本时空包返回
 *   - 配置 LLM_API_KEY 时逐段真翻译（上限 20 段，超出 status=partial）；未配置时 zh=en 且不伪造翻译
 *   - figures P0 恒为 []（真实图表提取由 FastAPI PyMuPDF 管线承担，P1 接入）
 */
import { NextRequest } from "next/server";
import { ensureSeed, fail } from "@/lib/server/utils";
import { getDB, jsonParse } from "@/lib/server/db";
import { hasLLM, translateText } from "@/lib/server/llm";
import {
  getKnowledgePaper,
  recordKnowledgeFallback,
  shouldFallbackToLocal,
  shouldUseRemoteKnowledgeBase,
} from "@/lib/server/knowledge-base";

export const runtime = "nodejs";

const MAX_PARAGRAPHS = 20;

/** 摘要 → 段落列表：优先按空行切分；单段过长时按句号粗切，便于逐段对照 */
function splitParagraphs(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  let parts = trimmed
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 1 && parts[0].length > 500) {
    const sentences = parts[0].split(/(?<=[.!?。！？])\s+/);
    const chunks: string[] = [];
    let buf = "";
    for (const s of sentences) {
      if (buf && (buf + " " + s).length > 400) {
        chunks.push(buf);
        buf = s;
      } else {
        buf = buf ? buf + " " + s : s;
      }
    }
    if (buf) chunks.push(buf);
    parts = chunks;
  }
  return parts;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  ensureSeed();
  try {
    const { id } = await params;
    const lang = new URL(req.url).searchParams.get("lang") || "zh";
    if (lang !== "zh") return fail("P0 仅支持 lang=zh");

    const db = getDB();

    // 1) 缓存命中直接返回
    const cached = db
      .prepare("SELECT * FROM reading_packs WHERE paper_id = ? AND lang = ?")
      .get(id, lang) as any;
    if (cached) {
      return Response.json({
        success: true,
        data: {
          status: cached.status,
          paper: jsonParse(cached.paper_meta_json, null),
          sections: jsonParse(cached.sections_json, []),
          figures: jsonParse(cached.figures_json, []),
        },
      });
    }

    // 2) 取英文原文与论文元数据（远程知识底座优先，回退本地库摘要）
    let title = "";
    let meta = "";
    let sourceText = "";
    const row = db.prepare("SELECT * FROM papers WHERE id = ?").get(id) as any;
    if (row) {
      title = row.title || id;
      meta = [row.venue, row.authors].filter(Boolean).join(" · ");
      sourceText = (row.abstract || "").trim();
    } else if (shouldUseRemoteKnowledgeBase()) {
      try {
        const paper = await getKnowledgePaper(id);
        title = paper.title || id;
        meta = [paper.venue, paper.authors].filter(Boolean).join(" · ");
        sourceText = (paper.abstract || "").trim();
      } catch (error) {
        if (!shouldFallbackToLocal()) {
          return fail(error instanceof Error ? error.message : "知识底座暂不可用", 502);
        }
        recordKnowledgeFallback();
      }
    }
    if (!row && !sourceText && !title) return fail("论文未找到", 404);

    // 3) 生成翻译（无 LLM 时 zh=en 原样，不做假翻译）
    const useLlm = hasLLM();
    const paragraphs = splitParagraphs(sourceText);
    const truncated = paragraphs.length > MAX_PARAGRAPHS;
    const chosen = paragraphs.slice(0, MAX_PARAGRAPHS);

    let titleZh = title;
    let summaryZh = sourceText.slice(0, 300);
    let failed = 0;
    if (useLlm && sourceText) {
      try {
        titleZh = (await translateText(title, "中文")) || title;
      } catch {}
      try {
        summaryZh = (await translateText(sourceText.slice(0, 300), "中文")) || summaryZh;
      } catch {}
    }
    const translated = await Promise.all(
      chosen.map(async (en) => {
        if (!useLlm) return en;
        try {
          return (await translateText(en, "中文")) || en;
        } catch {
          failed += 1;
          return "";
        }
      })
    );

    const sections = chosen.length
      ? [
          {
            id: "abstract",
            heading: "Abstract",
            headingZh: "摘要",
            paragraphs: chosen.map((en, i) => ({ id: `abstract-p${i + 1}`, en, zh: translated[i] })),
          },
        ]
      : [];

    const status = !chosen.length ? "ready" : failed > 0 || truncated ? "partial" : "ready";
    const paperMeta = { title, titleZh, meta, summaryZh, translated: useLlm && chosen.length > 0 };

    db.prepare(
      `INSERT OR REPLACE INTO reading_packs (paper_id, lang, status, sections_json, figures_json, paper_meta_json)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, lang, status, JSON.stringify(sections), "[]", JSON.stringify(paperMeta));

    return Response.json({
      success: true,
      data: { status, paper: paperMeta, sections, figures: [] },
    });
  } catch (e: any) {
    return fail(e.message || "生成精读包失败");
  }
}