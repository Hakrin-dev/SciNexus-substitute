/**
 * POST /api/search
 * AI 语义搜索（兼容旧项目搜索接口逻辑）
 *
 * Body: {
 *   query: string,            // 搜索关键词
 *   mode?: 'keyword'|'semantic',
 *   ccf?: 'A'|'B'|'C',
 *   year_from?: number,
 *   year_to?: number,
 *   sort_by?: 'relevance'|'citations'|'date',
 *   task_type?: string,
 *   top_k?: number
 * }
 */
import { NextRequest, NextResponse } from "next/server";
import { ensureSeed, fail, parseBody, genId } from "@/lib/server/utils";
import { getDB, jsonParse, mapPaper } from "@/lib/server/db";
import { chatText } from "@/lib/server/llm";
import {
  searchKnowledgeBase,
  shouldFallbackToLocal,
  shouldUseRemoteKnowledgeBase,
  toFrontendKnowledgePaper,
} from "@/lib/server/knowledge-base";

export const runtime = "nodejs";

interface SearchReq {
  query: string;
  mode?: string;
  ccf?: string;
  year_from?: number;
  year_to?: number;
  sort_by?: string;
  task_type?: string;
  top_k?: number;
  conference?: string[];
  author?: string[];
  keyword?: string[];
  subject?: string[];
  /** 快速→深度会话串联:沿用调用方传入的会话 id,缺省则新建 */
  conversation_id?: string;
}

export async function POST(req: NextRequest) {
  const start = Date.now();
  try {
    const body = await parseBody<SearchReq>(req);
    if (!body.query?.trim()) return fail("搜索关键词不能为空");

    const q = body.query.toLowerCase().trim();
    const tokens = q.split(/\s+/).filter(Boolean);

    if (shouldUseRemoteKnowledgeBase()) {
      try {
        const remote = await searchKnowledgeBase({
          query: body.query.trim(),
          topK: body.top_k,
          yearFrom: body.year_from,
          yearTo: body.year_to,
          conferences: body.conference,
          authors: body.author,
          keywords: body.keyword,
          subjects: body.subject,
        });
        const data = remote.results.map(toFrontendKnowledgePaper);
        const conversationId = body.conversation_id || genId("conv_");
        return NextResponse.json({
          success: true,
          data,
          summary: await quickSummary(body.query, data),
          conversation_id: conversationId,
          meta: {
            query: body.query,
            count: data.length,
            search_time: remote.tookMs / 1000,
            source: "remote_knowledge_base",
            fallbackUsed: false,
            queryParse: remote.queryParse,
            queryRewrite: remote.queryRewrite,
            state: remote.state,
            task_type: body.task_type || "paper_search",
            conversation_id: conversationId,
            agents: ["supervisor", "scout"],
            workflow: {
              steps: [
                { agent: "supervisor", action: "识别检索意图并授权知识底座", status: "done" },
                { agent: "scout", action: "远程知识底座召回真实论文", status: "done" },
              ],
            },
          },
        });
      } catch (error) {
        console.warn("[scinexus] 远程知识底座检索失败", error);
        if (!shouldFallbackToLocal()) {
          return fail(error instanceof Error ? error.message : "知识底座暂不可用", 502);
        }
      }
    }

    ensureSeed();
    const db = getDB();

    // 1. 意图分解
    const subQueries = decomposeIntent(q);
    const checklist = generateChecklist(q);

    // 2. 候选召回：优先 FTS5 全文索引，命中则缩小扫描范围；否则回退全表
    const ftsIds = ftsRecall(db, q);
    const ftsSet = ftsIds && ftsIds.length > 0 ? new Set(ftsIds) : null;
    const rows = db.prepare("SELECT * FROM papers").all() as any[];
    let candidates: any[] = [];
    for (const r of rows) {
      if (ftsSet && !ftsSet.has(r.id)) continue;
      const title = (r.title || "").toLowerCase();
      const abstract = (r.abstract || "").toLowerCase();
      const tags = jsonParse<string[]>(r.tags_json, []).join(" ").toLowerCase();
      const blob = `${title} ${abstract} ${tags}`;
      let hits = 0;
      for (const t of tokens) {
        if (blob.includes(t)) hits++;
      }
      if (hits > 0 || tokens.length === 0) {
        const score = relevanceScore(title, abstract, tags, subQueries);
        candidates.push({
          ...mapPaper(r),
          ccf: r.ccf,
          year: r.year,
          checklist_score: score,
          match: score >= 90 ? "perfect" : score >= 70 ? "partial" : "weak",
          matchLabel: score >= 90 ? "Perfect" : score >= 70 ? "Partial" : "Weak",
          match_reason:
            hits > 0
              ? `关键词匹配: ${tokens.filter((t) => blob.includes(t)).join(", ")}`
              : "语义相关",
        });
      }
    }

    // 3. CCF/年份过滤
    if (body.ccf) {
      candidates = candidates.filter((c) => c.ccf === body.ccf);
    }
    if (body.year_from) {
      candidates = candidates.filter((c) => (c.year || 0) >= body.year_from!);
    }
    if (body.year_to) {
      candidates = candidates.filter((c) => (c.year || 0) <= body.year_to!);
    }

    // 4. 排序
    const sortBy = body.sort_by || "relevance";
    if (sortBy === "citations") {
      candidates.sort((a, b) => Number(b.citations || 0) - Number(a.citations || 0));
    } else if (sortBy === "date") {
      candidates.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    } else {
      candidates.sort((a, b) => b.checklist_score - a.checklist_score);
    }

    const topK = Math.min(50, Math.max(1, body.top_k || 20));
    const data = candidates.slice(0, topK);
    const elapsed = (Date.now() - start) / 1000;
    const summary = await quickSummary(body.query, data);
    const conversationId = body.conversation_id || genId("conv_");

    return NextResponse.json({
      success: true,
      data,
      summary,
      conversation_id: conversationId,
      meta: {
        query: body.query,
        count: data.length,
        search_time: elapsed,
        mode: body.mode || "keyword",
        task_type: body.task_type || "paper_search",
        conversation_id: conversationId,
        agents: ["supervisor", "scout"],
        sub_queries: subQueries,
        checklist,
        workflow: {
          steps: [
            { agent: "supervisor", action: "识别检索意图并授权检索工具", status: "done" },
            { agent: "scout", action: "召回候选论文并计算相关度", status: "done" },
          ],
        },
      },
    });
  } catch (e: any) {
    return fail(e.message || "搜索失败");
  }
}

/** 基于检索结果生成「简易回答」（轻量 LLM，失败回退模板） */
const QUICK_ANSWER_PROMPT =
  "你是研枢科研助手的快速检索总结器。请用 2~4 句话直接简要回答用户的问题：结论优先，" +
  "必要时提及 1~2 篇最有代表性的论文（格式「标题（作者, 年份）」）作为支撑；" +
  "只依据下方论文信息作答，严禁编造；使用中文，段落式简短回答，不要列论文清单。";

async function quickSummary(query: string, papers: any[]): Promise<string> {
  if (!papers.length) {
    return `关于「${query}」，当前论文库未检索到匹配结果，建议更换关键词后重试。`;
  }
  const fallback = () => {
    const top = papers[0];
    const venue = (top?.venue || "") || "arXiv";
    return (
      `关于「${query}」，检索到 ${papers.length} 篇相关论文。` +
      `较有代表性的是 **${top?.title || ""}**（来源：${venue}）。` +
      `建议结合下方论文清单精读。`
    );
  };
  try {
    const payload = papers.slice(0, 6).map((p) => ({
      title: p.title,
      authors: p.authors,
      year: p.year,
      venue: p.venue,
      abstract: (p.abstract || "").slice(0, 200),
    }));
    const text = await chatText(
      QUICK_ANSWER_PROMPT,
      `问题：${query}\n\n论文信息：${JSON.stringify(payload)}`
    );
    return text && text.trim().length > 5 ? text.trim() : fallback();
  } catch {
    return fallback();
  }
}

const KEYWORDS_MAP: Record<string, string[]> = {
  大语言模型: ["llm", "language model", "pre-trained", "大模型"],
  推理优化: ["inference", "optimization", "efficient", "推理"],
  transformer: ["transformer", "attention", "self-attention"],
  注意力: ["attention", "self-attention", "multi-head"],
  综述: ["survey", "review", "comprehensive"],
  检索增强: ["rag", "retrieval", "augmented"],
  图神经网络: ["gnn", "graph", "neural"],
  对比学习: ["contrastive", "self-supervised", "simclr"],
  联邦学习: ["federated", "edge", "privacy"],
  扩散模型: ["diffusion", "generative", "ddpm"],
  微调: ["fine-tuning", "lora", "adaptation"],
  推荐: ["recommendation", "recommender"],
  机器人: ["robot", "manipulation", "policy"],
  智能体: ["agent", "autonomous", "workflow"],
};

function decomposeIntent(query: string) {
  const q = query.toLowerCase();
  const results: { intent: string; keywords: string[] }[] = [];
  for (const key of Object.keys(KEYWORDS_MAP)) {
    if (q.includes(key)) {
      results.push({ intent: key, keywords: KEYWORDS_MAP[key] });
    }
  }
  if (results.length === 0) {
    results.push({
      intent: "通用检索",
      keywords: q.split(/\s+/).filter((w) => w.length > 1),
    });
  }
  return results.slice(0, 5);
}

function generateChecklist(query: string) {
  return [
    "是否与查询主题高度相关？",
    "是否发表于CCF推荐的顶级会议/期刊？",
    "方法论是否经过严格实验验证？",
    "是否有足够的引用量支撑影响力？",
    "是否涵盖最新的研究进展（2023年后）？",
  ];
}

function relevanceScore(
  title: string,
  abstract: string,
  keywords: string,
  subQueries: { intent: string; keywords: string[] }[]
): number {
  let score = 0;
  let hits = 0;
  for (const sq of subQueries) {
    for (const kw of sq.keywords) {
      const k = kw.toLowerCase();
      if (title.includes(k)) {
        score += 3;
        hits++;
      } else if (abstract.includes(k)) {
        score += 2;
        hits++;
      } else if (keywords.includes(k)) {
        score += 1;
        hits++;
      }
    }
  }
  if (hits === 0) return 55;
  return Math.min(100, 60 + score * 5);
}

/**
 * 使用 FTS5 全文索引召回论文 ID。
 * 命中则返回 ID 列表，不可用或异常返回 null（调用方回退全表扫描）。
 */
function ftsRecall(db: any, query: string): string[] | null {
  try {
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!tokens.length) return null;
    const terms = tokens
      .map((t) => t.replace(/[^a-z0-9\u4e00-\u9fa5]/g, ""))
      .filter(Boolean)
      .map((t) => `"${t}"`);
    if (!terms.length) return null;
    const ftsQuery = terms.join(" AND ");
    const rows = db
      .prepare("SELECT id FROM papers_fts WHERE papers_fts MATCH ? ORDER BY rank LIMIT 50")
      .all(ftsQuery) as any[];
    return rows.map((r: any) => r.id);
  } catch {
    return null;
  }
}
