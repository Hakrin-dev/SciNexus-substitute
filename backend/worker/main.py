from __future__ import annotations

import argparse
import json
import os
import socket
import sqlite3
import sys
import time
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.auto_research import MockResearchAdapter
from backend.auto_research.protocol import STAGES, StageOutput

STALE_AFTER = "-2 minutes"
MAX_ATTEMPTS = 3

CARD_KIND_BY_STAGE = {
    "plan": "question",
    "search": "literature",
    "read": "literature",
    "synthesize": "hypothesis",
    "design": "experiment",
    "code": "experiment",
    "run": "result",
    "report": "conclusion",
}
ASSET_KIND_BY_STAGE = {
    "plan": "note",
    "search": "paper",
    "read": "paper",
    "synthesize": "note",
    "design": "experiment",
    "code": "experiment",
    "run": "dataset",
    "report": "note",
}


def now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def add_event(
    db: sqlite3.Connection,
    run: dict[str, Any],
    kind: str,
    message: str,
    payload: dict[str, Any] | None = None,
    level: str = "info",
) -> None:
    sequence = db.execute(
        "SELECT COALESCE(MAX(sequence),0)+1 FROM research_run_events WHERE run_id=?",
        (run["id"],),
    ).fetchone()[0]
    db.execute(
        "INSERT INTO research_run_events VALUES (?,?,?,?,?,?,?,?,?)",
        (
            f"event_{run['id']}_{sequence}",
            run["id"],
            run["project_id"],
            kind,
            level,
            message,
            json.dumps(payload or {}, ensure_ascii=False),
            sequence,
            now_iso(),
        ),
    )


def recover_stale_runs(db: sqlite3.Connection) -> None:
    stale = "(heartbeat_at IS NULL OR julianday(heartbeat_at) < julianday('now', ?))"
    at = now_iso()
    db.execute(
        f"UPDATE research_runs SET status='queued',worker_id=NULL,attempt=attempt+1,updated_at=? "
        f"WHERE status='running' AND {stale} AND attempt < ?",
        (at, STALE_AFTER, MAX_ATTEMPTS),
    )
    db.execute(
        f"UPDATE research_runs SET status='failed',error_message=?,finished_at=?,updated_at=? "
        f"WHERE status='running' AND {stale} AND attempt >= ?",
        ("执行器连续失联，已达到重试上限", at, at, STALE_AFTER, MAX_ATTEMPTS),
    )


def claim_run(db: sqlite3.Connection, run_id: str | None = None) -> dict[str, Any] | None:
    db.row_factory = sqlite3.Row
    db.execute("BEGIN IMMEDIATE")
    recover_stale_runs(db)
    if run_id:
        row = db.execute(
            "SELECT * FROM research_runs WHERE id=? AND status='queued'",
            (run_id,),
        ).fetchone()
    else:
        row = db.execute(
            "SELECT * FROM research_runs WHERE status='queued' ORDER BY created_at LIMIT 1",
        ).fetchone()
    if not row:
        db.commit()
        return None

    worker_id = f"{socket.gethostname()}:{os.getpid()}"
    at = now_iso()
    db.execute(
        "UPDATE research_runs SET status='running',worker_id=?,heartbeat_at=?,"
        "started_at=COALESCE(started_at,?),updated_at=? WHERE id=?",
        (worker_id, at, at, at, row["id"]),
    )
    db.commit()
    return dict(row)


def apply_control(db: sqlite3.Connection, run: dict[str, Any]) -> bool:
    row = db.execute(
        "SELECT control_requested FROM research_runs WHERE id=?",
        (run["id"],),
    ).fetchone()
    requested = row[0] if row else None
    at = now_iso()
    if requested == "pause":
        db.execute(
            "UPDATE research_runs SET status='paused',control_requested=NULL,updated_at=? WHERE id=?",
            (at, run["id"]),
        )
        add_event(db, run, "paused", "任务已在阶段检查点暂停")
        db.commit()
        return True
    if requested == "cancel":
        db.execute(
            "UPDATE research_runs SET status='cancelled',control_requested=NULL,finished_at=?,updated_at=? WHERE id=?",
            (at, at, run["id"]),
        )
        add_event(db, run, "cancelled", "任务已取消")
        db.commit()
        return True
    return False


def persist_stage_output(
    db: sqlite3.Connection,
    run: dict[str, Any],
    output: StageOutput,
) -> None:
    artifact_id = f"mock_artifact_{run['id']}_{output.stage}"
    thread_id = f"ar_thread_{run['id']}"
    card_id = f"ar_card_{run['id']}_{output.stage}"
    at = now_iso()

    db.execute(
        "INSERT INTO wb_threads (id,project_id,question_node_id,title,stage) VALUES (?,?, '',?,?) "
        "ON CONFLICT(id) DO UPDATE SET title=excluded.title,stage=excluded.stage",
        (thread_id, run["project_id"], f"自动研究：{run['objective'][:70]}", output.stage),
    )
    db.execute(
        "INSERT INTO wb_thread_cards "
        "(id,project_id,thread_id,kind,title,summary,status,ai_generated,created_at,asset_refs_json,stage) "
        "VALUES (?,?,?,?,?,?,'done',1,?,?,?) "
        "ON CONFLICT(id) DO UPDATE SET title=excluded.title,summary=excluded.summary,"
        "status='done',asset_refs_json=excluded.asset_refs_json,stage=excluded.stage",
        (
            card_id,
            run["project_id"],
            thread_id,
            CARD_KIND_BY_STAGE[output.stage],
            output.title,
            output.summary,
            at,
            json.dumps([artifact_id]),
            output.stage,
        ),
    )
    db.execute(
        "INSERT INTO research_artifacts "
        "(id,run_id,project_id,stage,kind,title,uri,content,metadata_json,created_at) "
        "VALUES (?,?,?,?,?,?,?,?,?,?) "
        "ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,title=excluded.title,"
        "content=excluded.content,metadata_json=excluded.metadata_json",
        (
            artifact_id,
            run["id"],
            run["project_id"],
            output.stage,
            output.artifact_kind,
            output.title,
            None,
            output.content,
            json.dumps({**output.metadata, "stage": output.stage}, ensure_ascii=False),
            at,
        ),
    )
    db.execute(
        "INSERT INTO wb_assets "
        "(id,project_id,kind,title,meta,status,tags_json,question_ids_json,hypothesis_ids_json,updated_at) "
        "VALUES (?,?,?,?,?,'analyzed',?,'[]','[]',?) "
        "ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,title=excluded.title,"
        "meta=excluded.meta,tags_json=excluded.tags_json,updated_at=excluded.updated_at",
        (
            artifact_id,
            run["project_id"],
            ASSET_KIND_BY_STAGE[output.stage],
            output.title,
            f"自动研究 · {output.stage}",
            json.dumps(["自动研究", output.stage], ensure_ascii=False),
            at,
        ),
    )

    if output.stage == "run":
        metrics = output.content
        try:
            json.loads(metrics)
        except (TypeError, json.JSONDecodeError):
            metrics = json.dumps({"result": output.content}, ensure_ascii=False)
        db.execute(
            "INSERT INTO research_experiments "
            "(id,run_id,project_id,title,round,status,hypothesis,metrics_json,stdout,stderr,code_ref,created_at,updated_at) "
            "VALUES (?,?,?, ?,1,'passed',?,? ,?,'',?, ?,?) "
            "ON CONFLICT(id) DO UPDATE SET status='passed',metrics_json=excluded.metrics_json,"
            "stdout=excluded.stdout,updated_at=excluded.updated_at",
            (
                f"exp_{run['id']}",
                run["id"],
                run["project_id"],
                "自动研究实验 #1",
                "平台闭环验证",
                metrics,
                "experiment completed",
                f"mock_artifact_{run['id']}_code",
                at,
                at,
            ),
        )


def execute_run(db: sqlite3.Connection, run: dict[str, Any]) -> None:
    adapter = MockResearchAdapter()
    for index, stage in enumerate(STAGES):
        if apply_control(db, run):
            return

        instructions = db.execute(
            "SELECT id,content FROM research_run_instructions "
            "WHERE run_id=? AND status='pending' ORDER BY created_at",
            (run["id"],),
        ).fetchall()
        instruction_text = "\n".join(row["content"] for row in instructions)
        if instructions:
            applied_at = now_iso()
            db.executemany(
                "UPDATE research_run_instructions SET status='applied',applied_at=? WHERE id=?",
                [(applied_at, row["id"]) for row in instructions],
            )
            add_event(
                db,
                run,
                "instruction_applied",
                f"已在 {stage} 阶段应用 {len(instructions)} 条追加指令",
                {"stage": stage},
            )

        progress = round(index / len(STAGES) * 100)
        phase = "experiment" if stage in ("design", "code", "run") else stage
        at = now_iso()
        db.execute(
            "UPDATE research_runs SET engine_stage=?,phase=?,progress=?,heartbeat_at=?,updated_at=? WHERE id=?",
            (stage, phase, progress, at, at, run["id"]),
        )
        add_event(db, run, "stage_started", f"开始{stage}阶段", {"stage": stage, "executionMode": "mock"})
        db.commit()

        output = adapter.execute_stage(stage, run["objective"], {"instructions": instruction_text})
        persist_stage_output(db, run, output)
        add_event(db, run, "stage_completed", output.summary, {"stage": stage, "executionMode": "mock"})
        db.commit()
        time.sleep(0.15)

    decision = {
        "action": "accept",
        "reason": "模拟八阶段闭环已完成；不代表真实研究结论",
        "progressed": True,
        "executionMode": "mock",
    }
    at = now_iso()
    db.execute(
        "UPDATE research_runs SET status='completed',phase='report',engine_stage='report',"
        "progress=100,decision_json=?,finished_at=?,updated_at=? WHERE id=?",
        (json.dumps(decision, ensure_ascii=False), at, at, run["id"]),
    )
    add_event(db, run, "completed", "模拟研究运行完成", decision)
    db.commit()


def fail_run(db: sqlite3.Connection, run: dict[str, Any], error: Exception) -> None:
    at = now_iso()
    db.execute(
        "UPDATE research_runs SET status='failed',error_message=?,finished_at=?,updated_at=? WHERE id=?",
        (str(error), at, at, run["id"]),
    )
    add_event(db, run, "failed", str(error), level="error")
    db.commit()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--db",
        type=Path,
        default=Path(os.getenv("SCINEXUS_DB_PATH", ROOT / "data" / "yanshu.db")),
    )
    parser.add_argument("--once", action="store_true")
    parser.add_argument("--run-id")
    parser.add_argument("--poll", type=float, default=2)
    args = parser.parse_args()

    while True:
        with sqlite3.connect(args.db, timeout=30) as db:
            run = claim_run(db, args.run_id)
            if run:
                try:
                    execute_run(db, run)
                except Exception as error:  # Worker boundary: persist failure before continuing.
                    fail_run(db, run, error)
        if args.once:
            return
        time.sleep(args.poll)


if __name__ == "__main__":
    main()
