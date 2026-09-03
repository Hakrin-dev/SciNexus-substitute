/**
 * 课题工作台路由的共享工具:项目归属校验与行映射。
 */
import { getDB, jsonParse } from "./db";
import { genId } from "./utils";

type Row = Record<string, unknown>;

export function mapThread(r: Row) {
  return {
    id: String(r.id),
    questionId: String(r.question_node_id || ""),
    title: String(r.title || ""),
    stage: String(r.stage || ""),
  };
}

export function mapCard(r: Row) {
  const card: {
    id: string;
    threadId: string;
    kind: string;
    title: string;
    summary: string;
    stage: string;
    status: string;
    assetRefs: string[];
    nodeRef?: string;
    aiGenerated?: boolean;
    createdAt: string;
  } = {
    id: String(r.id),
    threadId: String(r.thread_id),
    kind: String(r.kind),
    title: String(r.title || ""),
    summary: String(r.summary || ""),
    stage: String(r.stage || "plan"),
    status: String(r.status),
    assetRefs: jsonParse<string[]>(String(r.asset_refs_json || "[]"), []),
    createdAt: String(r.created_at || ""),
  };
  if (r.node_ref) card.nodeRef = String(r.node_ref);
  if (Number(r.ai_generated)) card.aiGenerated = true;
  return card;
}

export function mapAsset(r: Row) {
  const asset: Record<string, unknown> = {
    id: String(r.id),
    kind: String(r.kind),
    title: String(r.title || ""),
    meta: String(r.meta || ""),
    questionIds: jsonParse<string[]>(String(r.question_ids_json || "[]"), []),
    hypothesisIds: jsonParse<string[]>(String(r.hypothesis_ids_json || "[]"), []),
    status: String(r.status),
    tags: jsonParse<string[]>(String(r.tags_json || "[]"), []),
    updatedAt: String(r.updated_at || ""),
  };
  if (r.artifact_run_id) {
    asset.artifact = {
      runId: String(r.artifact_run_id),
      kind: String(r.artifact_kind || "other"),
      uri: r.artifact_uri ? String(r.artifact_uri) : null,
      content: r.artifact_content === null || r.artifact_content === undefined ? null : String(r.artifact_content),
      metadata: jsonParse<Record<string, unknown>>(String(r.artifact_metadata_json || "{}"), {}),
      createdAt: String(r.artifact_created_at || r.updated_at || ""),
    };
  }
  return asset;
}

export type ProjectPermission = "read" | "write" | "admin" | "owner";
export type ProjectRole = "public" | "viewer" | "editor" | "admin" | "owner";
export type OrganizationRole = "viewer" | "member" | "admin" | "owner";

const ROLE_LEVEL: Record<ProjectRole, number> = { public: 1, viewer: 1, editor: 2, admin: 3, owner: 4 };
const PERMISSION_LEVEL: Record<ProjectPermission, number> = { read: 1, write: 2, admin: 3, owner: 4 };

/** 单一权限入口：所有项目资源都应使用这里，而不是各自拼 user_id SQL。 */
export function projectRole(projectId: string, userId?: string | null): ProjectRole | null {
  const row = getDB().prepare(
    `SELECT p.user_id, p.visibility, pm.role AS member_role, om.role AS organization_role
       FROM projects p
       LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ?
       LEFT JOIN organization_members om ON om.organization_id = p.organization_id AND om.user_id = ?
      WHERE p.id = ?`,
  ).get(userId ?? "", userId ?? "", projectId) as { user_id: string; visibility: string; member_role?: ProjectRole; organization_role?: OrganizationRole } | undefined;
  if (!row) return null;
  if (userId && row.user_id === userId) return "owner";
  if (row.member_role) return row.member_role;
  if (row.visibility === "organization" && row.organization_role) {
    return row.organization_role === "owner" ? "owner" : row.organization_role === "admin" ? "admin" : row.organization_role === "member" ? "editor" : "viewer";
  }
  if (row.visibility === "public_readonly") return "public";
  return null;
}

export function projectMembers(projectId: string) {
  return getDB().prepare(`SELECT u.id AS user_id, u.username, u.display_name, pm.role
    FROM project_members pm JOIN users u ON u.id = pm.user_id
    WHERE pm.project_id = ? ORDER BY CASE pm.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'editor' THEN 2 ELSE 3 END, u.username`)
    .all(projectId).map((row: any) => ({ userId: row.user_id, name: row.display_name || row.username, username: row.username, role: row.role }));
}

export function canAccessProject(projectId: string, userId: string | null | undefined, permission: ProjectPermission): boolean {
  const role = projectRole(projectId, userId);
  return role !== null && ROLE_LEVEL[role] >= PERMISSION_LEVEL[permission];
}

export function writeAudit(params: { userId?: string | null; projectId?: string | null; action: string; resourceType: string; resourceId?: string | null; metadata?: unknown }) {
  getDB().prepare(`INSERT INTO audit_logs
    (id, user_id, project_id, action, resource_type, resource_id, metadata_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(genId("audit_"), params.userId ?? null, params.projectId ?? null, params.action,
      params.resourceType, params.resourceId ?? null, JSON.stringify(params.metadata ?? {}), new Date().toISOString());
}
