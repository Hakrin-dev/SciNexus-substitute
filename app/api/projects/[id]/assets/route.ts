/**
 * GET /api/projects/[id]/assets - 工作台资产
 */
import { NextRequest } from "next/server";
import { ensureSeed, fail, ok } from "@/lib/server/utils";
import { getDB } from "@/lib/server/db";
import { getCurrentUser } from "@/lib/server/auth";
import { canAccessProject, mapAsset } from "@/lib/server/workbench";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  ensureSeed();
  const { id } = await params;
  try {
    if (!canAccessProject(id, getCurrentUser(req)?.id, "read")) return fail("项目不存在", 404);

    const rows = getDB()
      .prepare(
        `SELECT a.*, r.run_id AS artifact_run_id, r.kind AS artifact_kind,
                r.uri AS artifact_uri, r.content AS artifact_content,
                r.metadata_json AS artifact_metadata_json, r.created_at AS artifact_created_at
           FROM wb_assets a
           LEFT JOIN research_artifacts r ON r.id = a.id AND r.project_id = a.project_id
          WHERE a.project_id = ? ORDER BY a.updated_at DESC`
      )
      .all(id) as unknown as Record<string, unknown>[];
    return ok(rows.map(mapAsset));
  } catch (e) {
    return fail(e instanceof Error ? e.message : "获取资产失败");
  }
}
