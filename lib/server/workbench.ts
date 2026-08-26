/**
 * 课题工作台路由的共享工具:项目归属校验与行映射。
 */
import { getDB, jsonParse } from "./db";

/** 校验项目存在且属于该用户 */
export function assertProjectOwner(projectId: string, userId: string): boolean {
  return !!getDB()
    .prepare("SELECT 1 FROM projects WHERE id = ? AND user_id = ?")
    .get(projectId, userId);
}

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
