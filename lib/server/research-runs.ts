import type Database from "better-sqlite3";
import { spawn } from "node:child_process";
import path from "node:path";
import { getDB, jsonParse } from "./db";
import { genId } from "./utils";

export const RESEARCH_PHASES = ["plan", "search", "read", "synthesize", "experiment", "report"] as const;
export const RESEARCH_ENGINE_STAGES = ["plan", "search", "read", "synthesize", "design", "code", "run", "report"] as const;
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

/** Web 端只负责持久化排队；独立 Python worker 领取并执行任务。 */
export class DurableQueueResearchExecutor implements ResearchExecutor {
  readonly name = "simple-autoresearch";
  async start(runId: string) {
    if (process.env.NODE_ENV === "development" && process.env.AUTO_RESEARCH_EMBEDDED_WORKER !== "false") {
      const useUv = process.platform === "win32" && !process.env.PYTHON_EXECUTABLE;
      const command = process.env.PYTHON_EXECUTABLE || (useUv ? "uv" : "python3");
      const args = useUv
        ? ["run", "--project", "backend/auto_research", "python", "-m", "backend.worker.main", "--once", "--run-id", runId]
        : ["-m", "backend.worker.main", "--once", "--run-id", runId];
      const child = spawn(command, args, {
        cwd: process.cwd(),
        detached: true,
        stdio: "ignore",
        env: { ...process.env, SCINEXUS_DB_PATH: path.join(process.cwd(), "data", "yanshu.db"), UV_CACHE_DIR: path.join(process.cwd(), ".uv-cache") },
      });
      child.once("error", (error) => {
        const db = getDB();
        db.prepare("UPDATE research_runs SET status = 'failed', error_message = ?, finished_at = ?, updated_at = ? WHERE id = ? AND status = 'queued'")
          .run(`无法启动本地研究执行器：${error.message}`, nowIso(), nowIso(), runId);
      });
      child.unref();
      return { accepted: true, message: "本地研究执行器已启动" };
    }
    return { accepted: true, message: "研究任务已进入自动研究队列" };
  }
  async pause() {}
  async resume() {}
  async cancel() {}
}

export const researchExecutor: ResearchExecutor = new DurableQueueResearchExecutor();

export function displayPhase(stage: string): ResearchPhase {
  return (["design", "code", "run"].includes(stage) ? "experiment" : stage) as ResearchPhase;
}

export function nowIso() { return new Date().toISOString(); }

export function mapRun(row: Row) {
  return {
    id: String(row.id), projectId: String(row.project_id), objective: String(row.objective),
    status: String(row.status), phase: String(row.phase), progress: Number(row.progress),
    engineStage: String(row.engine_stage || row.phase), runDir: row.run_dir ? String(row.run_dir) : null,
    executor: String(row.executor), stopReason: row.stop_reason ? String(row.stop_reason) : null,
    errorMessage: row.error_message ? String(row.error_message) : null,
    controlRequested: row.control_requested ? String(row.control_requested) : null,
    attempt: Number(row.attempt || 1), decision: jsonParse(String(row.decision_json || "null"), null),
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
  const sequence = Number((db.prepare("SELECT COALESCE(MAX(sequence), 0) + 1 AS n FROM research_run_events WHERE run_id = ?").get(params.runId) as { n: number }).n);
  const event = { id: genId("re_"), createdAt: nowIso(), sequence, ...params };
  db.prepare(`INSERT INTO research_run_events
    (id, run_id, project_id, kind, level, message, payload_json, sequence, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(event.id, event.runId, event.projectId, event.kind, event.level || "info", event.message,
      JSON.stringify(event.payload || {}), event.sequence, event.createdAt);
  return event;
}

export function mapEvent(row: Row) {
  return { id: String(row.id), runId: String(row.run_id), kind: String(row.kind), level: String(row.level),
    message: String(row.message), payload: jsonParse(String(row.payload_json || "{}"), {}), sequence: Number(row.sequence || 0), createdAt: String(row.created_at) };
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
