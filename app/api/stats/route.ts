/**
 * GET /api/stats
 * 平台概览统计
 */
import { NextResponse } from "next/server";
import { ensureSeed } from "@/lib/server/utils";
import { getDB } from "@/lib/server/db";

export const runtime = "nodejs";

export async function GET() {
  ensureSeed();
  const db = getDB();
  const papers = (db.prepare("SELECT COUNT(*) as n FROM papers").get() as any).n;
  const scholars = (db.prepare("SELECT COUNT(*) as n FROM scholars").get() as any).n;
  const institutions = (db.prepare("SELECT COUNT(*) as n FROM institutions").get() as any).n;
  return NextResponse.json({
    success: true,
    data: {
      papers_today: 128,
      active_users: 3286,
      reviews_writing: 47,
      deadline_alerts: 5,
      papers_total: papers,
      scholars_total: scholars,
      institutions_total: institutions,
    },
  });
}
