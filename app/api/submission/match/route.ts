/**
 * POST /api/submission/match
 * 投稿方向匹配：根据标题、摘要计算各会议/期刊匹配度
 *
 * Body: {
 *   title: string,
 *   abstract: string,
 *   keywords?: string[],
 *   use_llm?: boolean   // 为真且已配置 LLM 时走语义匹配;失败自动回退关键词
 * }
 */
import { NextRequest, NextResponse } from "next/server";
import { ensureSeed, fail, parseBody } from "@/lib/server/utils";
import { getDB, jsonParse } from "@/lib/server/db";
import { chatText, hasLLM } from "@/lib/server/llm";

export const runtime = "nodejs";

interface MatchReq {
  title: string;
  abstract: string;
  keywords?: string[];
  use_llm?: boolean;
}

/** 匹配结果条目(Venue 视觉字段 + 匹配字段) */
interface MatchedVenue {
  id: string;
  kind: string;
  abbr: string;
  fullName: string;
  badges: unknown[];
  metaRows: unknown[][];
  chips: string[];
  accent: string;
  deadline?: { label: string; dateText: string | null; offsetMs: number };
  matchPct: number;
  matchClass: "high" | "mid" | "low";
  matchReason: string;
}

const DOMAIN_KEYWORDS: Record<string, string[]> = {
  人工智能: ["vision", "image", "visual", "detection", "图像", "视觉", "目标检测", "language", "text", "nlp", "transformer", "bert", "gpt", "语言", "文本", "翻译", "machine learning", "deep learning", "model", "training", "机器学习", "深度学习", "模型", "训练", "artificial intelligence", "ai", "智能", "人工智能", "agent"],
  数据挖掘: ["data mining", "recommend", "graph", "anomaly", "数据挖掘", "推荐", "图挖掘", "异常检测"],
  计算机体系结构: ["architecture", "parallel", "storage", "cache", "processor", "体系结构", "并行", "存储", "处理器", "芯片"],
};

type VenueRow = Record<string, unknown>;

function classOf(score: number): "high" | "mid" | "low" {
  return score >= 80 ? "high" : score >= 60 ? "mid" : "low";
}

function reasonOf(domain: string, score: number): string {
  return `论文内容与${domain || "综合"}领域${
    score >= 80 ? "高度相关" : score >= 60 ? "较为相关" : "存在一定差异"
  }（匹配度 ${score}%）`;
}

function clampPct(n: unknown): number {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return 50;
  return Math.max(50, Math.min(95, v));
}

/** 关键词路径:领域词典子串命中计分 */
function keywordMatch(venues: VenueRow[], blob: string): MatchedVenue[] {
  const matched = venues.map((v) => {
    const domain = String(v.domain || "");
    const kws = DOMAIN_KEYWORDS[domain] || [];
    let hits = 0;
    for (const kw of kws) {
      if (blob.includes(kw.toLowerCase())) hits++;
    }
    let nameBonus = 0;
    const abbr = String(v.abbr || "");
    if (abbr && blob.includes(abbr.toLowerCase())) nameBonus = 8;
    const score = Math.max(50, Math.min(95, 50 + hits * 6 + nameBonus));
    return {
      id: String(v.id),
      kind: String(v.kind),
      abbr,
      fullName: String(v.full_name || ""),
      badges: jsonParse<unknown[]>(String(v.badges_json || "[]"), []),
      metaRows: jsonParse<unknown[][]>(String(v.meta_rows_json || "[]"), []),
      chips: jsonParse<string[]>(String(v.chips_json || "[]"), []),
      accent: String(v.accent || "success"),
      deadline: v.deadline_label
        ? {
            label: String(v.deadline_label),
            dateText: v.deadline_date ? String(v.deadline_date) : null,
            offsetMs: Number(v.deadline_offset_ms) || 0,
          }
        : undefined,
      matchPct: score,
      matchClass: classOf(score),
      matchReason: reasonOf(domain, score),
    };
  });
  matched.sort((a, b) => b.matchPct - a.matchPct);
  return matched.slice(0, 5);
}

const MATCH_SYSTEM_PROMPT =
  "你是研枢（SciNexus）的投稿顾问，负责把用户稿件与候选会议/期刊做语义匹配。" +
  "只依据给出的候选列表作答，严禁编造不存在的 id。" +
  "输出要求：仅输出一个 JSON 数组，不要任何解释文字或代码围栏；" +
  '每个元素形如 {"id": "候选id", "matchPct": 50到95的整数, "reason": "一句话中文理由"}；' +
  "最多给出 5 条，按匹配度从高到低排序。";

/** LLM 语义匹配:失败返回 null(调用方回退关键词路径) */
async function llmMatch(
  venues: VenueRow[],
  title: string,
  abstract: string,
  keywords: string[],
): Promise<MatchedVenue[] | null> {
  const candidates = venues.map((v) => ({
    id: String(v.id),
    abbr: String(v.abbr || ""),
    fullName: String(v.full_name || ""),
    domain: String(v.domain || ""),
  }));
  const userText =
    `【稿件】\n标题：${title}\n摘要：${abstract}\n关键词：${keywords.join("、") || "无"}\n\n` +
    `【候选会议/期刊】\n${JSON.stringify(candidates)}\n\n` +
    "请给出匹配结果 JSON 数组。";
  let text: string | null = null;
  try {
    text = await chatText(MATCH_SYSTEM_PROMPT, userText);
  } catch {
    return null;
  }
  if (!text) return null;

  try {
    // 容错剥离可能的 markdown 围栏
    const stripped = text.replace(/```(?:json)?/gi, "").trim();
    const start = stripped.indexOf("[");
    const end = stripped.lastIndexOf("]");
    if (start < 0 || end <= start) return null;
    const parsed = JSON.parse(stripped.slice(start, end + 1)) as unknown;

    if (!Array.isArray(parsed)) return null;
    const byId = new Map(venues.map((v) => [String(v.id), v]));
    const items = parsed
      .filter(
        (it): it is { id: string; matchPct: number; reason: string } =>
          !!it &&
          typeof it === "object" &&
          typeof (it as Record<string, unknown>).id === "string" &&
          byId.has(String((it as Record<string, unknown>).id)),
      )
      .slice(0, 5)
      .map((it) => {
        const v = byId.get(String(it.id)) as VenueRow;
        const domain = String(v.domain || "");
        const score = clampPct(it.matchPct);
        const reason =
          typeof it.reason === "string" && it.reason.trim().length > 3
            ? it.reason.trim().slice(0, 120)
            : reasonOf(domain, score);
        return {
          id: String(v.id),
          kind: String(v.kind),
          abbr: String(v.abbr || ""),
          fullName: String(v.full_name || ""),
          badges: jsonParse<unknown[]>(String(v.badges_json || "[]"), []),
          metaRows: jsonParse<unknown[][]>(String(v.meta_rows_json || "[]"), []),
          chips: jsonParse<string[]>(String(v.chips_json || "[]"), []),
          accent: String(v.accent || "success"),
          deadline: v.deadline_label
            ? {
                label: String(v.deadline_label),
                dateText: v.deadline_date ? String(v.deadline_date) : null,
                offsetMs: Number(v.deadline_offset_ms) || 0,
              }
            : undefined,
          matchPct: score,
          matchClass: classOf(score),
          matchReason: reason,
        };
      });
    items.sort((a, b) => b.matchPct - a.matchPct);
    return items.length ? items : null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  ensureSeed();
  try {
    const body = await parseBody<MatchReq>(req);
    if (!body.title && !body.abstract) return fail("标题和摘要不能为空");

    const db = getDB();
    const venues = db.prepare("SELECT * FROM venues").all() as VenueRow[];

    let mode: "llm" | "keyword" = "keyword";
    let data: MatchedVenue[];

    if (body.use_llm && hasLLM()) {
      const llmResult = await llmMatch(
        venues,
        body.title || "",
        body.abstract || "",
        body.keywords || [],
      );
      if (llmResult) {
        data = llmResult;
        mode = "llm";
      } else {
        // LLM 失败/解析不出:静默回退关键词
        const blob = [body.title || "", body.abstract || "", ...(body.keywords || [])]
          .join(" ")
          .toLowerCase();
        data = keywordMatch(venues, blob);
      }
    } else {
      const blob = [body.title || "", body.abstract || "", ...(body.keywords || [])]
        .join(" ")
        .toLowerCase();
      data = keywordMatch(venues, blob);
    }

    return NextResponse.json({
      success: true,
      data,
      input: { title: body.title, keywords: body.keywords || [] },
      mode,
    });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "投稿匹配失败");
  }
}
