/**
 * GET /api/projects/[id]/overview - 概览聚合
 * focus / blockers / suggestions 均由工作台数据实时派生,无独立存储:
 * - focus:首个研究线程对应的问题节点 + 最近整理的文档 + 运行中的实验;
 * - blockers:存疑假设(contested)与未读文献;
 * - suggestions:未读文献、待办的「下一步」卡、待确认的结论卡。
 */
import { NextRequest } from "next/server";
import { ensureSeed, fail, ok } from "@/lib/server/utils";
import { getDB } from "@/lib/server/db";
import { getCurrentUser } from "@/lib/server/auth";
import { canAccessProject } from "@/lib/server/workbench";

export const runtime = "nodejs";

type Row = Record<string, unknown>;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  ensureSeed();
  const { id } = await params;
  try {
    if (!canAccessProject(id, getCurrentUser(req)?.id, "read")) return fail("项目不存在", 404);

    const db = getDB();
    const thread = db
      .prepare("SELECT * FROM wb_threads WHERE project_id = ? ORDER BY id LIMIT 1")
      .get(id) as Row | undefined;

    // focus:首线程的问题节点
    let focus: Record<string, unknown> = {
      questionId: "",
      question: "",
      recentDocs: [],
      runningExperiments: [],
    };
    if (thread) {
      const qid = String(thread.question_node_id || "");
      const qNode = qid
        ? (db.prepare("SELECT title FROM wb_outline_nodes WHERE id = ? AND project_id = ?").get(qid, id) as Row | undefined)
        : undefined;
      const recentDocs = db
        .prepare(
          `SELECT title FROM wb_assets WHERE project_id = ? AND status IN ('analyzed','active')
           ORDER BY updated_at DESC LIMIT 2`
        )
        .all(id) as Row[];
      const running = db
        .prepare(
          `SELECT title, meta FROM wb_assets WHERE project_id = ? AND kind = 'experiment' AND status = 'active'
           ORDER BY updated_at DESC LIMIT 2`
        )
        .all(id) as Row[];
      focus = {
        questionId: qid,
        question: String(qNode?.title || thread.title || ""),
        recentDocs: recentDocs.map((r) => String(r.title)),
        runningExperiments: running.map((r) =>
          String(r.meta).includes("运行中") ? `${r.title}(${String(r.meta).split(" · ")[1] ?? "运行中"})` : r.title
        ),
      };
    }

    const contested = db
      .prepare(
        `SELECT id, title FROM wb_outline_nodes WHERE project_id = ? AND kind = 'hypothesis' AND status = 'contested'
         ORDER BY sort LIMIT 2`
      )
      .all(id) as Row[];
    const unreadAssets = db
      .prepare(
        `SELECT id, title FROM wb_assets WHERE project_id = ? AND status = 'unread' ORDER BY updated_at DESC`
      )
      .all(id) as Row[];
    const nextCards = db
      .prepare(
        `SELECT id, title FROM wb_thread_cards WHERE project_id = ? AND kind = 'next' AND status = 'todo' LIMIT 2`
      )
      .all(id) as Row[];
    const conclusionCards = db
      .prepare(
        `SELECT id, title FROM wb_thread_cards WHERE project_id = ? AND kind = 'conclusion' AND status = 'todo' LIMIT 1`
      )
      .all(id) as Row[];

    const blockers: { id: string; text: string; view: "outline" | "assets" | "thread" }[] = [
      ...contested.map((n) => ({
        id: `blk-${n.id}`,
        text: `假设「${n.title}」证据尚未收敛`,
        view: "outline" as const,
      })),
      ...unreadAssets.slice(0, Math.max(0, 2 - contested.length)).map((a) => ({
        id: `blk-${a.id}`,
        text: `文献「${a.title}」待阅读`,
        view: "assets" as const,
      })),
    ];

    const suggestions: { id: string; text: string; view: "outline" | "assets" | "thread" }[] = [
      ...unreadAssets.slice(0, 1).map((a) => ({
        id: `sug-${a.id}`,
        text: `阅读「${a.title}」,评估其与本项目的关联`,
        view: "assets" as const,
      })),
      ...nextCards.map((c) => ({
        id: `sug-${c.id}`,
        text: String(c.title),
        view: "thread" as const,
      })),
      ...conclusionCards.map((c) => ({
        id: `sug-${c.id}`,
        text: `确认结论「${c.title}」后关闭对应线程`,
        view: "thread" as const,
      })),
    ].slice(0, 3);

    return ok({ focus, blockers, suggestions });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "获取概览失败");
  }
}
