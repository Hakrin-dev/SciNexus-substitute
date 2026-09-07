import { getDB } from "./db";
import { chatText } from "./llm";
import { genId } from "./utils";

export interface RetrievedMemory {
  fact: string;
  scope: "global" | "project";
  project?: string;
  source: string;
}

function terms(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9][a-z0-9_-]{1,}|[\u4e00-\u9fff]{2,}/g) || [])
    .filter((term, index, all) => all.indexOf(term) === index);
}

function normalizeFact(fact: string): string {
  return fact.replace(/[\s。；;，,]+/g, "").toLowerCase();
}

function containsSensitiveData(text: string): boolean {
  return /(?:password|密码|口令|api[_ -]?key|token|secret|身份证|护照|银行卡|信用卡|\b1[3-9]\d{9}\b|\b\d{15,19}\b)/i.test(text);
}

/** 读取已启用且与当前问题相关的用户长期记忆。 */
export function retrieveMemories(userId: string, query: string, projectId?: string, limit = 6): RetrievedMemory[] {
  const db = getDB();
  const setting = db
    .prepare("SELECT enabled FROM memory_settings WHERE user_id = ?")
    .get(userId) as { enabled?: number } | undefined;
  if (!setting?.enabled) return [];

  const rows = db
    .prepare(
      `SELECT fact, scope, project, source, created_at
       FROM memory_entries
       WHERE user_id = ? AND enabled = 1
         AND (scope = 'global' OR project_id = ?)
       ORDER BY created_at DESC
       LIMIT 100`
    )
    .all(userId, projectId ?? "") as Array<{
    fact: string;
    scope: string;
    project?: string;
    source: string;
    created_at: string;
  }>;
  const queryTerms = terms(query);

  return rows
    .map((row, index) => {
      const memoryTerms = terms(row.fact);
      const overlap = queryTerms.filter((term) => memoryTerms.includes(term)).length;
      return { row, overlap, score: overlap * 10 - index * 0.01 };
    })
    .filter(({ overlap }) => queryTerms.length === 0 || overlap > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ row }) => ({
      fact: row.fact,
      scope: row.scope === "project" ? "project" : "global",
      project: row.project,
      source: row.source,
    }));
}

function heuristicFacts(message: string): string[] {
  const patterns = [
    /(?:请记住|记住|记一下)[：:，,]?\s*(.+)/i,
    /(?:我偏好|我喜欢|我的研究方向是|我正在研究|我正在准备|我的实验环境是)[：:，,]?\s*(.+)/i,
  ];
  const candidates = patterns
    .map((pattern) => message.match(pattern)?.[0]?.trim())
    .filter((fact): fact is string => Boolean(fact));
  return candidates.filter((fact) => fact.length >= 4 && fact.length <= 300);
}

async function extractFacts(message: string, model?: string): Promise<string[]> {
  const fallback = heuristicFacts(message);
  const extracted = await chatText(
    "你是科研助手的长期记忆筛选器。只提取用户明确表达、未来对话仍有用的稳定事实，例如研究方向、偏好、实验约束、当前项目。不要提取临时问题、模型回答、推测或敏感信息。只输出 JSON 数组，每项是 1 条不超过 120 字的中文事实；没有合适事实时输出 []。",
    `用户消息：${message}`,
    model,
  );
  if (!extracted) return fallback;
  try {
    const parsed = JSON.parse(extracted.match(/\[[\s\S]*\]/)?.[0] || "[]");
    if (!Array.isArray(parsed)) return fallback;
    const facts = parsed
      .filter((fact): fact is string => typeof fact === "string")
      .map((fact) => fact.trim())
      .filter((fact) => fact.length >= 4 && fact.length <= 300);
    return facts.length ? facts.slice(0, 3) : fallback;
  } catch {
    return fallback;
  }
}

/** 对话完成后异步提取稳定事实；失败不会影响主回复。 */
export async function captureConversationMemory(
  userId: string,
  message: string,
  model?: string,
): Promise<void> {
  const db = getDB();
  const setting = db
    .prepare("SELECT enabled FROM memory_settings WHERE user_id = ?")
    .get(userId) as { enabled?: number } | undefined;
  if (!setting?.enabled || containsSensitiveData(message)) return;

  const facts = await extractFacts(message, model);
  if (!facts.length) return;
  const existing = db
    .prepare("SELECT fact FROM memory_entries WHERE user_id = ?")
    .all(userId) as Array<{ fact: string }>;
  const known = new Set(existing.map((row) => normalizeFact(row.fact)));
  const source = `对话-${new Date().toISOString().slice(0, 10)}`;
  const insert = db.prepare(
    `INSERT INTO memory_entries (id, user_id, fact, scope, source)
     VALUES (?, ?, ?, 'global', ?)`
  );
  for (const fact of facts.filter((item) => !containsSensitiveData(item))) {
    const normalized = normalizeFact(fact);
    if (!known.has(normalized)) {
      insert.run(genId("mem_"), userId, fact, source);
      known.add(normalized);
    }
  }
}
