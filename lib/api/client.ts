/** 研枢后端 API 客户端：fetch 封装 + SSE 流式解析。 */

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { signal, cache: "no-store" });
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return (await res.json()) as T;
}

export async function apiPost<T>(
  path: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return (await res.json()) as T;
}

/** SSE 流式事件（对应后端 /api/chat/stream、/api/translate/stream 协议） */
export type ChatStreamEvent =
  | {
      type: "meta";
      meta: {
        conversation_id?: string;
        workflow?: unknown;
        generated_files?: unknown;
        references?: unknown;
        tokens?: number;
      };
    }
  | { type: "delta"; text: string }
  | { type: "done" };

/**
 * 解析后端 SSE 协议：
 *   event: meta  → 元信息（工作流/生成文件）
 *   data: {"choices":[{"delta":{"content":"..."}}]} → 增量文本
 *   event: done  → 结束
 */
export async function* streamChat(
  path: string,
  body: unknown,
  signal?: AbortSignal,
): AsyncGenerator<ChatStreamEvent, void, unknown> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  if (!res.body) throw new Error("流式响应缺少 body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) >= 0) {
      const raw = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);

      let event = "message";
      let data = "";
      for (const line of raw.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5);
      }
      if (!data) continue;

      if (event === "done") {
        yield { type: "done" };
        return;
      }
      try {
        const json = JSON.parse(data) as {
          choices?: { delta?: { content?: string } }[];
        };
        if (event === "meta") {
          yield { type: "meta", meta: json as never };
          continue;
        }
        const text = json?.choices?.[0]?.delta?.content ?? "";
        if (text) yield { type: "delta", text };
      } catch {
        // 忽略无法解析的分片
      }
    }
  }
  yield { type: "done" };
}
