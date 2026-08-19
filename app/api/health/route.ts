/**
 * GET /api/health
 * 服务健康检查
 */
import { NextResponse } from "next/server";
import { ensureSeed } from "@/lib/server/utils";
import { getDB } from "@/lib/server/db";

export const runtime = "nodejs";

export async function GET() {
  ensureSeed();
  const db = getDB();
  const papers = (db.prepare("SELECT COUNT(*) AS n FROM papers").get() as any).n;
  const scholars = (db.prepare("SELECT COUNT(*) AS n FROM scholars").get() as any).n;
  const institutions = (db.prepare("SELECT COUNT(*) AS n FROM institutions").get() as any).n;
  return NextResponse.json({
    status: "healthy",
    service: "研枢 YanShu API",
    version: "1.0.0",
    timestamp: Date.now(),
    stats: { papers, scholars, institutions },
  });
}
