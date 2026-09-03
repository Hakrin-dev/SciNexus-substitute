from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator


def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class RunStore:
    def __init__(self, db_path: Path) -> None:
        self.db_path = db_path.resolve()

    @contextmanager
    def connect(self) -> Iterator[sqlite3.Connection]:
        connection = sqlite3.connect(self.db_path, timeout=30)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("PRAGMA busy_timeout = 30000")
        try:
            yield connection
            connection.commit()
        finally:
            connection.close()

    def claim_next(self, worker_id: str, run_id: str | None = None) -> dict[str, Any] | None:
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            if run_id:
                row = db.execute(
                    "SELECT * FROM research_runs WHERE id = ? AND status = 'queued' AND control_requested IS NULL",
                    (run_id,),
                ).fetchone()
            else:
                row = db.execute(
                    "SELECT * FROM research_runs WHERE status = 'queued' AND control_requested IS NULL ORDER BY created_at LIMIT 1"
                ).fetchone()
            if row is None:
                return None
            at = utcnow()
            changed = db.execute(
                "UPDATE research_runs SET status = 'running', worker_id = ?, heartbeat_at = ?, "
                "started_at = COALESCE(started_at, ?), updated_at = ? WHERE id = ? AND status = 'queued'",
                (worker_id, at, at, at, row["id"]),
            ).rowcount
            if changed != 1:
                return None
            self._event(db, row["id"], row["project_id"], "status", "自动研究 worker 已领取任务", {"workerId": worker_id})
            return dict(db.execute("SELECT * FROM research_runs WHERE id = ?", (row["id"],)).fetchone())

    def get(self, run_id: str) -> dict[str, Any] | None:
        with self.connect() as db:
            row = db.execute("SELECT * FROM research_runs WHERE id = ?", (run_id,)).fetchone()
            return dict(row) if row else None

    def checkpoint(self, run: dict[str, Any], stage: str, progress: int, message: str, *, status: str = "running") -> None:
        phase = "experiment" if stage in {"design", "code", "run"} else stage
        at = utcnow()
        with self.connect() as db:
            db.execute(
                "UPDATE research_runs SET engine_stage = ?, phase = ?, progress = ?, status = ?, heartbeat_at = ?, updated_at = ? WHERE id = ?",
                (stage, phase, progress, status, at, at, run["id"]),
            )
            self._event(db, run["id"], run["project_id"], "phase", message, {"engineStage": stage, "phase": phase, "progress": progress})

    def finish(self, run: dict[str, Any], decision: dict[str, Any]) -> None:
        at = utcnow()
        with self.connect() as db:
            db.execute(
                "UPDATE research_runs SET status = 'completed', phase = 'report', engine_stage = 'report', progress = 100, "
                "decision_json = ?, control_requested = NULL, finished_at = ?, heartbeat_at = ?, updated_at = ? WHERE id = ?",
                (json.dumps(decision, ensure_ascii=False), at, at, at, run["id"]),
            )
            self._event(db, run["id"], run["project_id"], "status", "自动研究闭环完成", decision)

    def fail(self, run: dict[str, Any], stage: str, error: str) -> None:
        at = utcnow()
        with self.connect() as db:
            db.execute(
                "UPDATE research_runs SET status = 'failed', engine_stage = ?, error_message = ?, finished_at = ?, heartbeat_at = ?, updated_at = ? WHERE id = ?",
                (stage, error[:4000], at, at, at, run["id"]),
            )
            self._event(db, run["id"], run["project_id"], "error", f"{stage} 阶段失败", {"error": error[:4000]}, level="error")

    def apply_control(self, run: dict[str, Any]) -> bool:
        current = self.get(run["id"])
        if not current or not current.get("control_requested"):
            return False
        action = current["control_requested"]
        at = utcnow()
        status = "paused" if action == "pause" else "cancelled"
        with self.connect() as db:
            db.execute(
                "UPDATE research_runs SET status = ?, control_requested = NULL, updated_at = ?, finished_at = CASE WHEN ? = 'cancelled' THEN ? ELSE finished_at END WHERE id = ?",
                (status, at, status, at, run["id"]),
            )
            self._event(db, run["id"], run["project_id"], "status", f"研究任务已{('暂停' if status == 'paused' else '取消')}", {"status": status})
        return True

    def consume_instructions(self, run: dict[str, Any], run_dir: Path) -> list[str]:
        with self.connect() as db:
            rows = db.execute(
                "SELECT id, content FROM research_run_instructions WHERE run_id = ? AND status = 'pending' ORDER BY created_at",
                (run["id"],),
            ).fetchall()
            if not rows:
                return []
            contents = [str(row["content"]) for row in rows]
            path = run_dir / "user_instructions.md"
            with path.open("a", encoding="utf-8") as handle:
                for content in contents:
                    handle.write(f"\n- [{utcnow()}] {content}\n")
            db.executemany(
                "UPDATE research_run_instructions SET status = 'applied' WHERE id = ?",
                [(row["id"],) for row in rows],
            )
            self._event(db, run["id"], run["project_id"], "instruction", f"已在阶段边界应用 {len(rows)} 条用户指令", {"count": len(rows)})
            return contents

    def event(self, run: dict[str, Any], kind: str, message: str, payload: dict[str, Any], *, level: str = "info") -> None:
        with self.connect() as db:
            self._event(db, run["id"], run["project_id"], kind, message, payload, level=level)

    @staticmethod
    def _event(db: sqlite3.Connection, run_id: str, project_id: str, kind: str, message: str, payload: dict[str, Any], *, level: str = "info") -> None:
        sequence = int(db.execute("SELECT COALESCE(MAX(sequence), 0) + 1 FROM research_run_events WHERE run_id = ?", (run_id,)).fetchone()[0])
        db.execute(
            "INSERT INTO research_run_events (id, run_id, project_id, kind, level, message, payload_json, sequence, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (f"re_{run_id}_{sequence}", run_id, project_id, kind, level, message, json.dumps(payload, ensure_ascii=False), sequence, utcnow()),
        )
