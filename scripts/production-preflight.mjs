#!/usr/bin/env node
const required = ["DOMAIN", "AUTH_SECRET", "RETRIEVAL_API_URL", "RETRIEVAL_API_TOKEN"];
const failures = required.filter((key) => !process.env[key]?.trim()).map((key) => `${key} 未配置`);
if ((process.env.AUTH_SECRET || "").length > 0 && (process.env.AUTH_SECRET || "").length < 32) failures.push("AUTH_SECRET 至少需要 32 个字符");
try { if (new URL(process.env.RETRIEVAL_API_URL || "").protocol !== "https:") failures.push("RETRIEVAL_API_URL 必须使用 HTTPS"); } catch { if (process.env.RETRIEVAL_API_URL) failures.push("RETRIEVAL_API_URL 不是有效 URL"); }
if ((process.env.CORS_ALLOW_ORIGINS || "").includes("*")) failures.push("CORS_ALLOW_ORIGINS 不得包含 *");
if (failures.length) { console.error(`生产预检失败：\n- ${failures.join("\n- ")}`); process.exit(1); }
console.log("生产预检通过：必填变量齐全，未输出任何密钥内容。");
