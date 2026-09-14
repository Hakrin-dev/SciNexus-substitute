#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const required = ["DOMAIN", "AUTH_SECRET", "RETRIEVAL_API_URL", "RETRIEVAL_API_TOKEN"];
const failures = required.filter((key) => !process.env[key]?.trim()).map((key) => `${key} 未配置`);
if (!process.env.SCINEXUS_DB_PATH?.trim() && !process.env.AUTH_DB_PATH?.trim()) {
  failures.push("SCINEXUS_DB_PATH 或 AUTH_DB_PATH 未配置：生产账户数据必须使用持久化数据库");
}
const configuredDbPath = process.env.SCINEXUS_DB_PATH?.trim() || process.env.AUTH_DB_PATH?.trim();
const dbPath = configuredDbPath ? path.resolve(configuredDbPath) : path.resolve("data/yanshu.db");
if (fs.existsSync(dbPath)) {
  try {
    const db = new Database(dbPath, { readonly: true });
    // 先读取 sqlite_master；仅执行 integrity_check 可能漏掉 malformed schema。
    db.prepare("SELECT type, name, tbl_name, rootpage, sql FROM sqlite_master").all();
    const integrity = db.pragma("integrity_check", { simple: true });
    db.close();
    if (integrity !== "ok") failures.push(`SQLite 数据库完整性检查失败：${dbPath}`);
  } catch {
    failures.push(`SQLite 数据库无法打开或 schema 已损坏：${dbPath}`);
  }
}
if ((process.env.AUTH_SECRET || "").length > 0 && (process.env.AUTH_SECRET || "").length < 32) failures.push("AUTH_SECRET 至少需要 32 个字符");
try { if (new URL(process.env.RETRIEVAL_API_URL || "").protocol !== "https:") failures.push("RETRIEVAL_API_URL 必须使用 HTTPS"); } catch { if (process.env.RETRIEVAL_API_URL) failures.push("RETRIEVAL_API_URL 不是有效 URL"); }
if ((process.env.CORS_ALLOW_ORIGINS || "").includes("*")) failures.push("CORS_ALLOW_ORIGINS 不得包含 *");
if (failures.length) { console.error(`生产预检失败：\n- ${failures.join("\n- ")}`); process.exit(1); }
console.log("生产预检通过：必填变量齐全，未输出任何密钥内容。");
