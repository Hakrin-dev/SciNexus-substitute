#!/usr/bin/env node
/**
 * 以人工标注集评估知识底座检索质量。
 *
 * 用法：node scripts/evaluate-knowledge-retrieval.mjs evaluation/knowledge-retrieval.jsonl
 * 每行：{"query":"...","relevantPaperIds":["paper:..."],"topK":10}
 */
import fs from "node:fs";
import process from "node:process";

const datasetPath = process.argv[2];
const baseUrl = (process.env.EVALUATION_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
if (!datasetPath) throw new Error("缺少标注集路径：node scripts/evaluate-knowledge-retrieval.mjs <dataset.jsonl>");
const rows = fs.readFileSync(datasetPath, "utf8").split(/\r?\n/).map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#")).map((line) => JSON.parse(line));
if (!rows.length) throw new Error("标注集为空；请添加至少一条带 relevantPaperIds 的人工标注。");

const metrics = { recall: 0, reciprocalRank: 0, ndcg: 0, failures: 0, fallbacks: 0, latencies: [] };
for (const row of rows) {
  const started = performance.now();
  try {
    const response = await fetch(`${baseUrl}/api/search`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: row.query, top_k: row.topK ?? 10 }),
    });
    const body = await response.json();
    if (!response.ok || !body.success) throw new Error(body.error || `HTTP ${response.status}`);
    const ids = (body.data || []).map((paper) => paper.id || paper.paper_id).filter(Boolean);
    const relevant = new Set(row.relevantPaperIds || []);
    const hits = ids.map((id, index) => relevant.has(id) ? index + 1 : 0).filter(Boolean);
    metrics.recall += relevant.size ? hits.length / relevant.size : 0;
    metrics.reciprocalRank += hits.length ? 1 / hits[0] : 0;
    const dcg = hits.reduce((sum, rank) => sum + 1 / Math.log2(rank + 1), 0);
    const ideal = [...relevant].slice(0, ids.length).reduce((sum, _id, index) => sum + 1 / Math.log2(index + 2), 0);
    metrics.ndcg += ideal ? dcg / ideal : 0;
    if (body.meta?.fallbackUsed) metrics.fallbacks += 1;
  } catch (error) {
    metrics.failures += 1;
    console.error(JSON.stringify({ query: row.query, error: error instanceof Error ? error.message : String(error) }));
  } finally {
    metrics.latencies.push(performance.now() - started);
  }
}
metrics.latencies.sort((a, b) => a - b);
const completed = rows.length - metrics.failures;
console.log(JSON.stringify({
  queries: rows.length, completed, failed: metrics.failures,
  recallAtK: completed ? metrics.recall / completed : 0,
  mrr: completed ? metrics.reciprocalRank / completed : 0,
  ndcg: completed ? metrics.ndcg / completed : 0,
  p95Ms: metrics.latencies[Math.min(metrics.latencies.length - 1, Math.ceil(metrics.latencies.length * 0.95) - 1)] ?? null,
  fallbackRate: metrics.fallbacks / rows.length,
}, null, 2));
