from __future__ import annotations

import json
import sqlite3
import tempfile
import unittest
from pathlib import Path

from backend.worker.main import _next_stage_index, worker_config
from backend.worker.store import RunStore


SCHEMA = """
CREATE TABLE research_runs (
  id TEXT PRIMARY KEY, project_id TEXT, objective TEXT, status TEXT, phase TEXT,
  engine_stage TEXT, progress INTEGER, executor TEXT, config_json TEXT,
  control_requested TEXT, worker_id TEXT, heartbeat_at TEXT, attempt INTEGER,
  error_message TEXT, decision_json TEXT, started_at TEXT, finished_at TEXT,
  updated_at TEXT, created_at TEXT
);
CREATE TABLE research_run_events (
  id TEXT PRIMARY KEY, run_id TEXT, project_id TEXT, kind TEXT, level TEXT,
  message TEXT, payload_json TEXT, sequence INTEGER, created_at TEXT
);
CREATE TABLE research_run_instructions (
  id TEXT PRIMARY KEY, run_id TEXT, project_id TEXT, content TEXT, status TEXT,
  created_at TEXT
);
"""


class WorkerTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.db_path = self.root / "test.db"
        db = sqlite3.connect(self.db_path)
        try:
            db.executescript(SCHEMA)
            db.execute(
                "INSERT INTO research_runs VALUES (?, ?, ?, 'queued', 'plan', 'plan', 0, 'simple-autoresearch', '{}', NULL, NULL, NULL, 1, NULL, NULL, NULL, NULL, ?, ?)",
                ("run_1", "project_1", "test objective", "2026-01-01", "2026-01-01"),
            )
            db.commit()
        finally:
            db.close()
        self.store = RunStore(self.db_path)

    def tearDown(self) -> None:
        self.temp.cleanup()

    def test_claim_and_control_are_persistent(self) -> None:
        run = self.store.claim_next("worker:test")
        self.assertIsNotNone(run)
        self.assertEqual(self.store.get("run_1")["status"], "running")
        with self.store.connect() as db:
            db.execute("UPDATE research_runs SET control_requested = 'pause' WHERE id = 'run_1'")
        self.assertTrue(self.store.apply_control(run))
        self.assertEqual(self.store.get("run_1")["status"], "paused")

    def test_resume_uses_first_incomplete_stage(self) -> None:
        state = {name: {"status": "completed" if name in {"plan", "search"} else "pending"} for name in ("plan", "search", "read", "synthesize", "design", "code", "run", "report")}
        (self.root / "state.json").write_text(json.dumps(state), encoding="utf-8")
        self.assertEqual(_next_stage_index(self.root, "search"), 2)

    def test_worker_config_uses_engine_keys(self) -> None:
        config = worker_config({"config_json": json.dumps({"max_papers": 3})})
        self.assertIn("use_llm", config)
        self.assertIn("use_arxiv", config)
        self.assertEqual(config["max_papers"], 3)


if __name__ == "__main__":
    unittest.main()
