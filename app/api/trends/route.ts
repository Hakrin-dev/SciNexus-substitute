/**
 * GET /api/trends
 * 投稿趋势数据（各会议近 5 年录用率，演示数据）
 */
import { NextResponse } from "next/server";
import { ensureSeed } from "@/lib/server/utils";

export const runtime = "nodejs";

export async function GET() {
  ensureSeed();
  return NextResponse.json({
    success: true,
    data: [
      { abbr: "NeurIPS", years: ["2022", "2023", "2024", "2025", "2026"], rates: [25.7, 26.1, 25.8, 24.9, 23.6] },
      { abbr: "ICML", years: ["2022", "2023", "2024", "2025", "2026"], rates: [24.9, 27.9, 27.5, 26.3, 25.1] },
      { abbr: "CVPR", years: ["2022", "2023", "2024", "2025", "2026"], rates: [25.3, 25.8, 23.6, 22.4, 21.9] },
      { abbr: "ACL", years: ["2022", "2023", "2024", "2025", "2026"], rates: [24.5, 22.3, 21.3, 20.8, 19.7] },
      { abbr: "AAAI", years: ["2022", "2023", "2024", "2025", "2026"], rates: [15.0, 19.6, 23.7, 21.4, 17.6] },
    ],
  });
}
