/**
 * LLM 提供方抽象层
 * 配置 LLM_API_URL + LLM_API_KEY（OpenAI 兼容接口）时调用真实模型；
 * 未配置时回退到内置规则回复（演示用），保证不配置也能运行。
 */
import { genId } from "./utils";

export interface ChatReply {
  reply: string;
  workflow: any;
}

interface LLMConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export type ModelChoice = "默认" | "订阅" | "API接入";

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

/** 生成对话回复：优先真实 LLM，失败回退内置规则 */
export async function generateChatReply(
  message: string,
  taskType?: string
): Promise<ChatReply> {
  const llmText = await callLLM([
    {
      role: "system",
      content:
        "你是研枢（SciNexus）科研助手，面向人工智能领域研究者。用专业、简洁的中文回答；" +
        "涉及文献综述/论文推荐/投稿分析/润色/对比时请结构化输出。",
    },
    { role: "user", content: message },
  ]);

  if (llmText) {
    return {
      reply: llmText,
      workflow: {
        task_id: genId("task_"),
        agents: ["supervisor", "llm"],
        steps: [{ agent: "llm", action: "生成回复", status: "done" }],
        status: "done",
      },
    };
  }

  return mockReply(message, taskType);
}

/** 内置规则回复（无 LLM 配置时的兜底） */
function mockReply(message: string, taskType?: string): ChatReply {
  const msg = message;
  let reply = "";

  if (msg.includes("综述") || msg.includes("review") || msg.includes("survey")) {
    const topic = msg
      .replace(/帮我写|写一篇|关于|的(文献)?综述|请|给我|一个|论文/g, "")
      .trim() || "扩散模型在机器人学习中的应用";
    reply = `好的！我将为您撰写关于「${topic}」的文献综述。\n\n**综述大纲**\n1. 研究背景与发展脉络\n2. 核心技术与代表性工作\n3. 对比分析与关键挑战\n4. 未来展望与开放问题\n\n正在生成详细内容…`;
  } else if (msg.includes("推荐") || msg.includes("找") || msg.includes("推荐论文")) {
    reply =
      "为您检索到以下相关论文：\n\n" +
      "1. **Attention Is All You Need** (Vaswani et al., NeurIPS 2017) — 引用 128k+\n" +
      "2. **BERT** (Devlin et al., NAACL 2019) — 引用 65k+\n" +
      "3. **GPT-3** (Brown et al., NeurIPS 2020) — 引用 42k+\n\n" +
      "点击论文标题可查看详情。";
  } else if (msg.includes("润色") || msg.includes("修改") || msg.includes("polish")) {
    reply =
      "好的，请将需要润色的段落粘贴到对话中，我将从以下维度进行优化：\n" +
      "1. 语法与流畅度\n" +
      "2. 学术表达风格\n" +
      "3. 逻辑结构与衔接\n" +
      "4. 专业术语准确性";
  } else if (msg.includes("对比") || msg.includes("比较") || msg.includes("compare")) {
    reply = "好的，我来为您做对比分析。请告诉我需要对比哪些方法或模型？（可以直接输入名称列表）";
  } else if (msg.includes("投稿") || msg.includes("会议") || msg.includes("期刊")) {
    reply =
      "根据您的研究方向，我推荐以下投稿目标：\n" +
      "1. **AAAI 2027**（CCF-A）- 匹配度 88%  截稿 7月29日\n" +
      "2. **NeurIPS 2026** - 匹配度 85%\n" +
      "3. **IEEE TPAMI**（CCF-A 期刊）- 匹配度 90%\n\n" +
      "详细投稿策略请切换到「投稿分析」页面。";
  } else {
    const choices = [
      "这是一个很好的问题！让我从学术角度为您分析：\n\n根据最新的相关研究…",
      `关于「${msg}」，我检索到 ${10 + Math.floor(Math.random() * 20)} 篇相关工作，整理如下：\n\n1. 核心发现…\n2. 主要方法…\n3. 未来方向…`,
      "让我想想… 从方法论角度，这个问题可以从以下几个方面展开：\n• 背景与动机\n• 现有方法综述\n• 关键挑战与突破口",
      "这是一个很有价值的研究方向！让我先梳理关键要点…\n\n最新的代表性工作包括：\n• Diffusion Policy (CoRL 2023)\n• RDT-1B (ICML 2026)\n• Octo (RSS 2024)",
    ];
    reply = choices[Math.floor(Math.random() * choices.length)];
  }

  const workflow = {
    task_id: genId("task_"),
    agents: ["supervisor", taskType === "paper_search" ? "scout" : "writer"].filter(Boolean),
    steps: [
      { agent: "supervisor", action: "识别用户意图并规划子任务", status: "done" },
      { agent: taskType === "paper_search" ? "scout" : "writer", action: "生成最终回复", status: "done" },
    ],
    status: "done",
  };

  return { reply, workflow };
}
