/**
 * 课题工作台路由的共享工具:项目归属校验、枚举校验、行映射与树辅助。
 * wb_* 各表的 CHECK 约束与下文枚举集合保持同源(db.ts 建表处)。
 */
import type Database from "better-sqlite3";
import { getDB, jsonParse } from "./db";
import { genId } from "./utils";

/** 校验项目存在且属于该用户 */
export function assertProjectOwner(projectId: string, userId: string): boolean {
  return !!getDB()
    .prepare("SELECT 1 FROM projects WHERE id = ? AND user_id = ?")
    .get(projectId, userId);
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
    status: String(r.status),
    assetRefs: jsonParse<string[]>(String(r.asset_refs_json || "[]"), []),
    createdAt: String(r.created_at || ""),
  };
  if (r.node_ref) card.nodeRef = String(r.node_ref);
  if (Number(r.ai_generated)) card.aiGenerated = true;
  return card;
}

export function mapAsset(r: Row) {
  return {
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
}
