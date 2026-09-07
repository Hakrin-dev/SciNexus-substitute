import { spawn } from "node:child_process";
import type Database from "better-sqlite3";
import { getDB, jsonParse } from "./db";
import { genId } from "./utils";

type Row = Record<string, unknown>;

export const STAGES = ["plan", "search", "read", "synthesize", "design", "code", "run", "report"] as const;

export function nowIso() {
  return new Date().toISOString();
}

export function mapRun(value: unknown) {
  const row = value as Row;
  const stage = String(row.engine_stage);
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    objective: String(row.objective),
    status: String(row.status),
    phase: ["design", "code", "run"].includes(stage) ? "experiment" : stage,
    engineStage: stage,
    progress: Number(row.progress),
    executor: String(row.executor),
    controlRequested: row.control_requested ? String(row.control_requested) : null,
    attempt: Number(row.attempt),
    decision: jsonParse(String(row.decision_json || ""), null),
    errorMessage: row.error_message ? String(row.error_message) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    startedAt: row.started_at ? String(row.started_at) : null,
    finishedAt: row.finished_at ? String(row.finished_at) : null,
  };
}

export function mapEvent(value: unknown) {
  const row = value as Row;
  return {
    id: String(row.id),
    runId: String(row.run_id),
    kind: String(row.kind),
    level: String(row.level),
    message: String(row.message),
    payload: jsonParse(String(row.payload_json || "{}"), {}),
    sequence: Number(row.sequence),
    createdAt: String(row.created_at),
  };
}

export function mapExperiment(value: unknown) {
  const row = value as Row;
  return {
    id: String(row.id),
    runId: String(row.run_id),
    title: String(row.title),
    round: Number(row.round),
    status: String(row.status),
    hypothesis: row.hypothesis ? String(row.hypothesis) : null,
    metrics: jsonParse(String(row.metrics_json || "{}"), {}),
    stdout: String(row.stdout || ""),
    stderr: String(row.stderr || ""),
    codeRef: row.code_ref ? String(row.code_ref) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function appendEvent(
  db: Database.Database,
  input: { runId: string; projectId: string; kind: string; message: string; level?: string; payload?: unknown },
) {
  const sequence = (db.prepare(
    "SELECT COALESCE(MAX(sequence),0)+1 n FROM research_run_events WHERE run_id=?",
  ).get(input.runId) as { n: number }).n;
  db.prepare(`INSERT INTO research_run_events
    (id,run_id,project_id,kind,level,message,payload_json,sequence,created_at)
    VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(
      genId("event_"),
      input.runId,
      input.projectId,
      input.kind,
      input.level || "info",
      input.message,
      JSON.stringify(input.payload || {}),
      sequence,
      nowIso(),
    );
}

/** Local development starts a one-shot worker; production uses the dedicated worker service. */
export function launchMockWorker(runId: string) {
  if (process.env.NODE_ENV === "production" && process.env.AUTO_RESEARCH_INLINE_WORKER !== "true") return;
  const command = process.env.PYTHON_EXECUTABLE || (process.platform === "win32" ? "python" : "python3");
  const workerPath = "backend/worker/main.py";
  const child = spawn(command, [workerPath, "--once", "--run-id", runId], {
    detached: true,
    stdio: "ignore",
    env: process.env,
  });
  child.once("error", (error) => {
    const at = nowIso();
    getDB().prepare(`UPDATE research_runs
      SET status='failed',error_message=?,finished_at=?,updated_at=?
      WHERE id=? AND status='queued'`)
      .run(`无法启动研究执行器：${error.message}`, at, at, runId);
  });
  child.unref();
}
