/**
 * LLM 提供方抽象层
 * 配置 LLM_API_URL + LLM_API_KEY（OpenAI 兼容接口）时调用真实模型；
 * 未配置或调用失败时返回 null，由各调用方决定回退行为。
 */
interface LLMConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

/** 前端模型选择：具体模型名（演示）。"订阅"/"API接入" 为历史路由值，其余值回退默认模型 */
export type ModelChoice = string;

function getLLMConfig(modelChoice?: ModelChoice): LLMConfig | null {
  const apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const selectedModel = modelChoice === "订阅"
    ? process.env.LLM_SUBSCRIPTION_MODEL
    : modelChoice === "API接入"
      ? process.env.LLM_API_MODEL
      : undefined;
  return {
    baseUrl: (process.env.LLM_API_URL || "https://api.openai.com/v1").replace(/\/+$/, ""),
    apiKey,
    model: selectedModel || process.env.LLM_MODEL || "gpt-4o-mini",
  };
}

/** 调用 OpenAI 兼容的 chat/completions，失败或未配置返回 null */
export async function callLLM(
  messages: { role: string; content: string }[],
  modelChoice?: ModelChoice,
): Promise<string | null> {
  const cfg = getLLMConfig(modelChoice);
  if (!cfg) return null;
  try {
    const resp = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        messages,
        temperature: 0.7,
        max_tokens: 1024,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data?.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}

/** 是否配置了真实 LLM（未配置时各能力回退内置规则） */
export function hasLLM(): boolean {
  return getLLMConfig() !== null;
}

/** 通用文本生成：给定 system/user 提示词，返回模型文本（未配置/失败返回 null） */
export async function chatText(
  systemPrompt: string,
  userText: string,
  modelChoice?: ModelChoice,
): Promise<string | null> {
  return callLLM([
    { role: "system", content: systemPrompt },
    { role: "user", content: userText },
  ], modelChoice);
}

/** 学术文本翻译：有真实 LLM 时翻译，否则回退为原样返回（前端可据此提示） */
export async function translateText(
  text: string,
  targetLang = "中文",
  _sourceLang?: string | null
): Promise<string> {
  const llm = await chatText(
    `你是学术翻译助手，把用户文本翻译成${targetLang}，保持专业术语准确、语序自然，只输出译文。`,
    text
  );
  return llm ?? text;
}
