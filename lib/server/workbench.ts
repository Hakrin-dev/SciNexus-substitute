/**
 * 课题工作台路由的共享工具:项目归属校验、枚举校验、行映射与树辅助。
 * wb_* 各表的 CHECK 约束与下文枚举集合保持同源(db.ts 建表处)。
 */
import type Database from "better-sqlite3";
import { getDB, jsonParse } from "./db";
import { genId } from "./utils";

export type ProjectPermission = "read" | "write" | "admin" | "owner";
export type ProjectRole = "public" | "viewer" | "editor" | "admin" | "owner";
const ROLE_LEVEL: Record<ProjectRole, number> = { public: 1, viewer: 1, editor: 2, admin: 3, owner: 4 };
const PERMISSION_LEVEL: Record<ProjectPermission, number> = { read: 1, write: 2, admin: 3, owner: 4 };
type ProjectRoleRow = { user_id: string; visibility: string; member_role: ProjectRole | null; organization_role: string | null };
type ProjectMemberRow = { user_id: string; username: string; display_name: string | null; role: ProjectRole };

export function projectRole(projectId: string, userId?: string | null): ProjectRole | null {
  const row = getDB().prepare(`SELECT p.user_id,p.visibility,pm.role member_role,om.role organization_role
    FROM projects p LEFT JOIN project_members pm ON pm.project_id=p.id AND pm.user_id=?
    LEFT JOIN organization_members om ON om.organization_id=p.organization_id AND om.user_id=? WHERE p.id=?`)
    .get(userId ?? "", userId ?? "", projectId) as ProjectRoleRow | undefined;
  if (!row) return null;
  if (userId && row.user_id === userId) return "owner";
  if (row.member_role) return row.member_role;
  if (row.visibility === "organization" && row.organization_role) return row.organization_role === "owner" ? "owner" : row.organization_role === "admin" ? "admin" : row.organization_role === "member" ? "editor" : "viewer";
  return row.visibility === "public_readonly" ? "public" : null;
}

export function canAccessProject(projectId: string, userId: string | null | undefined, permission: ProjectPermission) {
  const role = projectRole(projectId, userId);
  return role !== null && ROLE_LEVEL[role] >= PERMISSION_LEVEL[permission];
}

/** Backward-compatible owner assertion; new routes should call canAccessProject. */
export function assertProjectOwner(projectId: string, userId: string): boolean {
  return canAccessProject(projectId, userId, "write");
}

export function projectMembers(projectId: string) {
  return getDB().prepare(`SELECT u.id user_id,u.username,u.display_name,pm.role FROM project_members pm JOIN users u ON u.id=pm.user_id
    WHERE pm.project_id=? ORDER BY CASE pm.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'editor' THEN 2 ELSE 3 END,u.username`).all(projectId)
    .map((row) => {
      const member = row as ProjectMemberRow;
      return { userId: member.user_id, username: member.username, name: member.display_name || member.username, role: member.role };
    });
}

export function writeAudit(input: { userId?: string | null; projectId?: string | null; action: string; resourceType: string; resourceId?: string | null; metadata?: unknown }) {
  getDB().prepare(`INSERT INTO audit_logs (id,user_id,project_id,action,resource_type,resource_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?)`)
    .run(genId("audit_"), input.userId ?? null, input.projectId ?? null, input.action, input.resourceType, input.resourceId ?? null, JSON.stringify(input.metadata ?? {}), new Date().toISOString());
}

/* ── 各表枚举(与 db.ts CHECK 约束一致)───────────────────────── */

export const OUTLINE_KINDS = ["question", "hypothesis", "evidence", "conclusion", "note"] as const;
export const NODE_STATUSES = ["open", "supported", "contested", "done"] as const;
export const CARD_KINDS = [
  "question",
  "literature",
  "hypothesis",
  "experiment",
  "result",
  "analysis",
  "conclusion",
  "next",
  "hint",
] as const;
export const CARD_STATUSES = ["todo", "doing", "done"] as const;
export const RESEARCH_STAGES = ["plan", "search", "read", "synthesize", "design", "code", "run", "report"] as const;
export const ASSET_KINDS = ["paper", "dataset", "note", "experiment"] as const;
export const ASSET_STATUSES = ["unread", "active", "analyzed", "archived"] as const;
export const ACTIVITY_TYPES = ["note", "literature", "data", "task", "summary"] as const;
export const ACTIVITY_ACTORS = ["user", "agent", "system"] as const;

export function isOneOf<T extends string>(v: unknown, arr: readonly T[]): v is T {
  return typeof v === "string" && (arr as readonly string[]).includes(v);
}

/** 生成带本地时区的 ISO 时间(与种子数据格式一致,便于字符串排序与前端 Date 解析) */
export function nowIso(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  const abs = Math.abs(off);
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(
    d.getMinutes()
  )}:${p(d.getSeconds())}${sign}${p(Math.floor(abs / 60))}:${p(abs % 60)}`;
}

/** 写一条活动日志(workbench 各写端点共用;成功响应前调用) */
export function logActivity(
  db: Database.Database,
  input: {
    projectId: string;
    actor?: (typeof ACTIVITY_ACTORS)[number];
    type?: (typeof ACTIVITY_TYPES)[number];
    text: string;
    threadId?: string | null;
  }
) {
  const actor = input.actor && isOneOf(input.actor, ACTIVITY_ACTORS) ? input.actor : "user";
  const type = input.type && isOneOf(input.type, ACTIVITY_TYPES) ? input.type : "note";
  db.prepare(
    `INSERT INTO wb_activity_log (id, project_id, actor, type, text, thread_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    genId("log_"),
    input.projectId,
    actor,
    type,
    input.text,
    input.threadId ?? null,
    nowIso()
  );
}

type Row = Record<string, unknown>;

/** wb_outline_nodes 行的具体列(树辅助用;SELECT 明确列时断言为此类型) */
export interface OutlineRow {
  id: string;
  parent_id: string | null;
  kind: string;
  title: string;
  status: string;
  detail: string | null;
  ai_note: string | null;
  sort: number;
  asset_refs_json: string;
}

/** outline 行 → 序列化节点(children 由调用方装配;入参兼容强类型行与 select * 行) */
export function mapNode(r: OutlineRow | Row) {
  const node: Record<string, unknown> = {
    id: String(r.id),
    kind: String(r.kind),
    title: String(r.title || ""),
    status: String(r.status || "open"),
    assetRefs: jsonParse<string[]>(String(r.asset_refs_json || "[]"), []),
    children: [],
  };
  if (r.detail) node.detail = String(r.detail);
  if (r.ai_note) node.aiNote = String(r.ai_note);
  return node as { id: string; children: { id: string }[] };
}

/** 平表 → 嵌套大纲树(父节点须先于子节点出现,由 ORDER BY sort 保证) */
export function buildOutlineTree(rows: OutlineRow[]): unknown[] {
  const byId = new Map<string, ReturnType<typeof mapNode>>();
  const roots: ReturnType<typeof mapNode>[] = [];
  for (const r of rows) byId.set(r.id, mapNode(r));
  for (const r of rows) {
    const node = byId.get(r.id)!;
    const parentId = r.parent_id;
    if (parentId && byId.has(parentId)) {
      byId.get(parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

/** 当前项目全部大纲节点行(按 sort,id) */
export function getOutlineRows(db: Database.Database, projectId: string): OutlineRow[] {
  return db
    .prepare(
      `SELECT id, parent_id, kind, title, status, detail, ai_note, sort, asset_refs_json
       FROM wb_outline_nodes WHERE project_id = ? ORDER BY sort, id`
    )
    .all(projectId) as unknown as OutlineRow[];
}

/** 收集以 nodeId 为根的整棵子树节点 id(用于删除级联与移动防环) */
export function collectSubtreeIds(rows: OutlineRow[], rootId: string): Set<string> {
  const ids = new Set<string>();
  const walk = (id: string) => {
    if (ids.has(id)) return;
    ids.add(id);
    for (const r of rows) {
      if (r.parent_id === id) walk(r.id);
    }
  };
  walk(rootId);
  return ids;
}

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
  const asset: Record<string,unknown> = {
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
  if(r.artifact_run_id) asset.artifact={runId:String(r.artifact_run_id),stage:String(r.artifact_stage),kind:String(r.artifact_kind),uri:r.artifact_uri==null?null:String(r.artifact_uri),content:r.artifact_content==null?null:String(r.artifact_content),metadata:jsonParse(String(r.artifact_metadata_json||"{}"),{})};
  return asset;
}
