/**
 * POST /api/submission/match
 * 投稿方向匹配：根据标题、摘要计算各会议/期刊匹配度
 *
 * Body: {
 *   title: string,
 *   abstract: string,
 *   keywords?: string[]
 * }
 */
import { NextRequest, NextResponse } from "next/server";
import { ensureSeed, fail, parseBody } from "@/lib/server/utils";
import { getDB, jsonParse } from "@/lib/server/db";

export const runtime = "nodejs";

interface MatchReq {
  title: string;
  abstract: string;
  keywords?: string[];
}

const DOMAIN_KEYWORDS: Record<string, string[]> = {
  人工智能: ["vision", "image", "visual", "detection", "图像", "视觉", "目标检测", "language", "text", "nlp", "transformer", "bert", "gpt", "语言", "文本", "翻译", "machine learning", "deep learning", "model", "training", "机器学习", "深度学习", "模型", "训练", "artificial intelligence", "ai", "智能", "人工智能", "agent"],
  数据挖掘: ["data mining", "recommend", "graph", "anomaly", "数据挖掘", "推荐", "图挖掘", "异常检测"],
  计算机体系结构: ["architecture", "parallel", "storage", "cache", "processor", "体系结构", "并行", "存储", "处理器", "芯片"],
};

export async function POST(req: NextRequest) {
  ensureSeed();
  try {
    const body = await parseBody<MatchReq>(req);
    if (!body.title && !body.abstract) return fail("标题和摘要不能为空");

    const db = getDB();
    const venues = db.prepare("SELECT * FROM venues").all() as any[];

    const blob = [body.title || "", body.abstract || "", ...(body.keywords || [])]
      .join(" ")
      .toLowerCase();

    const matched = venues.map((v) => {
      const domain = v.domain || "";
      const kws = DOMAIN_KEYWORDS[domain] || [];
      let hits = 0;
      for (const kw of kws) {
        if (blob.includes(kw.toLowerCase())) hits++;
      }
      let nameBonus = 0;
      if (v.abbr && blob.includes(v.abbr.toLowerCase())) nameBonus = 8;
      const score = Math.max(50, Math.min(95, 50 + hits * 6 + nameBonus));
      return {
        id: v.id,
        kind: v.kind,
        abbr: v.abbr,
        fullName: v.full_name,
        badges: jsonParse<any[]>(v.badges_json, []),
        metaRows: jsonParse<any[][]>(v.meta_rows_json, []),
        chips: jsonParse<string[]>(v.chips_json, []),
        accent: v.accent,
        deadline: v.deadline_label
          ? { label: v.deadline_label, dateText: v.deadline_date, offsetMs: v.deadline_offset_ms }
          : undefined,
        matchPct: score,
        matchClass: score >= 80 ? "high" : score >= 60 ? "mid" : "low",
        matchReason: `论文内容与${domain || "综合"}领域${
          score >= 80 ? "高度相关" : score >= 60 ? "较为相关" : "存在一定差异"
        }（匹配度 ${score}%）`,
      };
    });

    matched.sort((a, b) => b.matchPct - a.matchPct);
    return NextResponse.json({
      success: true,
      data: matched.slice(0, 5),
      input: { title: body.title, keywords: body.keywords || [] },
      mode: "keyword",
    });
  } catch (e: any) {
    return fail(e.message || "投稿匹配失败");
  }
}
