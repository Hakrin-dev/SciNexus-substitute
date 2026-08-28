import type Database from "better-sqlite3";
import { getDB, jsonParse } from "./db";
import { genId } from "./utils";

export const RESEARCH_PHASES = ["plan", "search", "read", "synthesize", "experiment", "report"] as const;
export type ResearchPhase = (typeof RESEARCH_PHASES)[number];
export type RunStatus = "queued" | "running" | "paused" | "completed" | "failed" | "cancelled";

type Row = Record<string, unknown>;

export interface ResearchExecutor {
  readonly name: string;
  start(runId: string): Promise<{ accepted: boolean; message: string }>;
  pause(runId: string): Promise<void>;
  resume(runId: string): Promise<void>;
  cancel(runId: string): Promise<void>;
}

/**
 * 当前占位执行器只确认请求，不运行任何研究代码。
 * 后续接入 SimpleAutoResearch 时实现同一接口并在此处替换即可。
 */
export class PlaceholderResearchExecutor implements ResearchExecutor {
  readonly name = "placeholder";
  async start() { return { accepted: true, message: "研究任务已登记，等待执行器接入" }; }
  async pause() {}
  async resume() {}
  async cancel() {}
}

export const researchExecutor: ResearchExecutor = new PlaceholderResearchExecutor();

export function nowIso() { return new Date().toISOString(); }

export function mapRun(row: Row) {
  return {
    id: String(row.id), projectId: String(row.project_id), objective: String(row.objective),
    status: String(row.status), phase: String(row.phase), progress: Number(row.progress),
    executor: String(row.executor), stopReason: row.stop_reason ? String(row.stop_reason) : null,
    errorMessage: row.error_message ? String(row.error_message) : null,
    createdAt: String(row.created_at), updatedAt: String(row.updated_at),
    startedAt: row.started_at ? String(row.started_at) : null,
    finishedAt: row.finished_at ? String(row.finished_at) : null,
  };
}

export function findOwnedRun(projectId: string, runId: string) {
  return getDB().prepare("SELECT * FROM research_runs WHERE id = ? AND project_id = ?").get(runId, projectId) as Row | undefined;
}

export function appendRunEvent(db: Database.Database, params: {
  runId: string; projectId: string; kind: string; message: string; level?: string; payload?: unknown;
}) {
  const event = { id: genId("re_"), createdAt: nowIso(), ...params };
  db.prepare(`INSERT INTO research_run_events
    (id, run_id, project_id, kind, level, message, payload_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(event.id, event.runId, event.projectId, event.kind, event.level || "info", event.message,
      JSON.stringify(event.payload || {}), event.createdAt);
  return event;
}

export function mapEvent(row: Row) {
  return { id: String(row.id), runId: String(row.run_id), kind: String(row.kind), level: String(row.level),
    message: String(row.message), payload: jsonParse(String(row.payload_json || "{}"), {}), createdAt: String(row.created_at) };
}

export function mapExperiment(row: Row) {
  return { id: String(row.id), runId: String(row.run_id), title: String(row.title), round: Number(row.round),
    status: String(row.status), hypothesis: row.hypothesis ? String(row.hypothesis) : null,
    metrics: jsonParse(String(row.metrics_json || "{}"), {}), stdout: String(row.stdout || ""), stderr: String(row.stderr || ""),
    codeRef: row.code_ref ? String(row.code_ref) : null, createdAt: String(row.created_at), updatedAt: String(row.updated_at) };
}

export function mapArtifact(row: Row) {
  return { id: String(row.id), runId: String(row.run_id), kind: String(row.kind), title: String(row.title),
    uri: row.uri ? String(row.uri) : null, content: row.content ? String(row.content) : null,
    metadata: jsonParse(String(row.metadata_json || "{}"), {}), createdAt: String(row.created_at) };
}
