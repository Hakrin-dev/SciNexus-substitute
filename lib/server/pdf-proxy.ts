import { lookup } from "node:dns/promises";

import { KnowledgeBaseError } from "@/lib/server/knowledge-base";
import { isPrivatePdfAddress } from "@/lib/pdf-safety";

const DEFAULT_MAX_BYTES = 50 * 1024 * 1024;
const MAX_REDIRECTS = 3;

function configuredMaxBytes(): number {
  const raw = Number(process.env.KNOWLEDGE_PDF_MAX_BYTES);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_MAX_BYTES;
}

async function assertSafePdfUrl(url: URL): Promise<void> {
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new KnowledgeBaseError("论文 PDF 地址无效", 502, "CONTRACT_VIOLATION");
  }
  if (["localhost", "localhost.localdomain"].includes(url.hostname.toLowerCase())) {
    throw new KnowledgeBaseError("论文 PDF 地址不可访问", 502, "CONTRACT_VIOLATION");
  }
  if (["1", "true", "yes"].includes((process.env.KNOWLEDGE_PDF_ALLOW_PRIVATE_NETWORK || "").toLowerCase())) return;

  let addresses: { address: string }[];
  try {
    addresses = await lookup(url.hostname, { all: true, verbatim: true });
  } catch {
    throw new KnowledgeBaseError("论文 PDF 地址不可解析", 502, "UPSTREAM_UNAVAILABLE");
  }
  if (!addresses.length || addresses.some(({ address }) => isPrivatePdfAddress(address))) {
    throw new KnowledgeBaseError("论文 PDF 地址不可访问", 502, "CONTRACT_VIOLATION");
  }
}

/** Fetch a PDF without exposing upstream URLs or allowing an upstream URL to reach private services. */
export async function fetchSafePdf(sourceUrl: string): Promise<Response> {
  let url: URL;
  try {
    url = new URL(sourceUrl);
  } catch {
    throw new KnowledgeBaseError("论文 PDF 地址无效", 502, "CONTRACT_VIOLATION");
  }

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    await assertSafePdfUrl(url);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    let response: Response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        cache: "no-store",
        redirect: "manual",
        headers: { Accept: "application/pdf" },
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new KnowledgeBaseError("论文 PDF 请求超时", 504, "TIMEOUT");
      }
      throw new KnowledgeBaseError("论文 PDF 暂不可用", 502, "UPSTREAM_UNAVAILABLE");
    } finally {
      clearTimeout(timer);
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location || redirects === MAX_REDIRECTS) {
        throw new KnowledgeBaseError("论文 PDF 重定向无效", 502, "CONTRACT_VIOLATION");
      }
      url = new URL(location, url);
      continue;
    }

    if (!response.ok || !response.body) {
      throw new KnowledgeBaseError("论文 PDF 暂不可用", 502, "UPSTREAM_UNAVAILABLE");
    }
    const length = Number(response.headers.get("content-length"));
    if (Number.isFinite(length) && length > configuredMaxBytes()) {
      throw new KnowledgeBaseError("论文 PDF 文件过大", 413, "CONTRACT_VIOLATION");
    }
    if (!response.headers.get("content-type")?.toLowerCase().includes("application/pdf")) {
      throw new KnowledgeBaseError("论文 PDF 返回格式无效", 502, "CONTRACT_VIOLATION");
    }
    return response;
  }
  throw new KnowledgeBaseError("论文 PDF 重定向无效", 502, "CONTRACT_VIOLATION");
}
