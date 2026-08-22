/**
 * GET /api/health/detailed
 * 详细健康检查：附加各数据集条目数量
 */
import { NextResponse } from "next/server";
import { ensureSeed } from "@/lib/server/utils";
import { getDB } from "@/lib/server/db";

export const runtime = "nodejs";

export async function GET() {
  ensureSeed();
  const db = getDB();
  const count = (table: string) => (db.prepare(`SELECT COUNT(*) as n FROM ${table}`).get() as any).n;
  return NextResponse.json({
    status: "healthy",
    service: "研枢 YanShu API",
    version: "1.0.0",
    papers_count: count("papers"),
    journals_count: count("venues"),
    conversations_count: count("conversations"),
    library_count: count("library_items"),
    scholars_count: count("scholars"),
    institutions_count: count("institutions"),
    timestamp: Date.now(),
  });
}
