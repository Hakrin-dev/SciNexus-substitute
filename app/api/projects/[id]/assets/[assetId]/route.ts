import { NextRequest } from "next/server";
import { ensureSeed, fail, ok } from "@/lib/server/utils";
import { getDB } from "@/lib/server/db";
import { getCurrentUser } from "@/lib/server/auth";
import { canAccessProject, mapAsset } from "@/lib/server/workbench";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; assetId: string }> },
) {
  ensureSeed();
  const { id, assetId } = await params;
  try {
    if (!canAccessProject(id, getCurrentUser(req)?.id, "read")) return fail("项目不存在", 404);

    const row = getDB().prepare(
      `SELECT a.*, r.run_id AS artifact_run_id, r.kind AS artifact_kind,
              r.uri AS artifact_uri, r.content AS artifact_content,
              r.metadata_json AS artifact_metadata_json, r.created_at AS artifact_created_at
         FROM wb_assets a
         LEFT JOIN research_artifacts r ON r.id = a.id AND r.project_id = a.project_id
        WHERE a.project_id = ? AND a.id = ?`,
    ).get(id, assetId) as Record<string, unknown> | undefined;

    if (!row) return fail("资产不存在", 404);
    return ok(mapAsset(row));
  } catch (error) {
    return fail(error instanceof Error ? error.message : "获取资产详情失败");
  }
}
