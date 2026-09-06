/** POST /api/knowledge/retry - 清除本进程的知识底座熔断状态，供用户主动重新探测。 */
import { NextResponse } from "next/server";
import { resetKnowledgeCircuit } from "@/lib/server/knowledge-base";

export const runtime = "nodejs";

export async function POST() {
  resetKnowledgeCircuit();
  return NextResponse.json({ success: true, data: { reset: true } });
}
