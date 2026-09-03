from __future__ import annotations

import hashlib
import json
import sqlite3
from pathlib import Path
from typing import Any

from .store import utcnow


STAGE_LABELS = {
    "plan": "研究计划",
    "search": "文献检索",
    "read": "结构化阅读",
    "synthesize": "证据综合",
    "design": "实验设计",
    "code": "实验代码",
    "run": "实验运行与判读",
    "report": "研究报告",
}


def project_stage(db_path: Path, run: dict[str, Any], run_dir: Path, stage: str) -> None:
    stage_number = list(STAGE_LABELS).index(stage) + 1
    stage_dir = run_dir / f"{stage_number:02d}-{stage}"
    outputs = _stage_outputs(stage_dir)
    now = utcnow()
    with sqlite3.connect(db_path, timeout=30) as db:
        thread_id = _ensure_thread(db, run, stage)
        card_id = f"ar_card_{run['id']}_{stage}"
        summary = _summary(stage_dir, stage, outputs)
        db.execute(
            "INSERT INTO wb_thread_cards (id, project_id, thread_id, kind, title, summary, stage, status, ai_generated, created_at, asset_refs_json) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, 'done', 1, ?, ?) ON CONFLICT(id) DO UPDATE SET summary=excluded.summary, status='done', asset_refs_json=excluded.asset_refs_json",
            (card_id, run["project_id"], thread_id, _card_kind(stage), STAGE_LABELS[stage], summary, stage, now, json.dumps([_artifact_id(run["id"], item) for item in outputs])),
        )
        db.execute(
            "UPDATE wb_thread_cards SET status = 'done' WHERE project_id = ? AND id <> ? AND status = 'doing' AND id LIKE ?",
            (run["project_id"], card_id, f"ar_card_{run['id']}_%"),
        )
        for relative in outputs:
            path = run_dir / relative
            artifact_id = _artifact_id(run["id"], relative)
            kind = _artifact_kind(path, stage)
            content = _small_text(path)
            metadata = {"stage": stage, "relativePath": relative, "size": path.stat().st_size, "sha256": _sha256(path), "producer": "simple-autoresearch"}
            db.execute(
                "INSERT INTO research_artifacts (id, run_id, project_id, kind, title, uri, content, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) "
                "ON CONFLICT(id) DO UPDATE SET kind=excluded.kind, title=excluded.title, uri=excluded.uri, content=excluded.content, metadata_json=excluded.metadata_json",
                (artifact_id, run["id"], run["project_id"], kind, path.name, relative, content, json.dumps(metadata, ensure_ascii=False), now),
            )
            _project_asset(db, run, artifact_id, path, stage, now)
        if stage == "run":
            _project_experiment(db, run, run_dir, now)
        db.execute(
            "INSERT OR REPLACE INTO wb_activity_log (id, project_id, actor, type, text, thread_id, created_at) VALUES (?, ?, 'agent', ?, ?, ?, ?)",
            (f"ar_log_{run['id']}_{stage}", run["project_id"], "summary" if stage == "report" else "task", f"自动研究完成「{STAGE_LABELS[stage]}」阶段", thread_id, now),
        )
        db.commit()


def _ensure_thread(db: sqlite3.Connection, run: dict[str, Any], stage: str) -> str:
    thread_id = f"ar_thread_{run['id']}"
    db.execute(
        "INSERT INTO wb_threads (id, project_id, question_node_id, title, stage) VALUES (?, ?, '', ?, ?) "
        "ON CONFLICT(id) DO UPDATE SET stage=excluded.stage",
        (thread_id, run["project_id"], f"自动研究：{run['objective'][:80]}", stage),
    )
    return thread_id


def _stage_outputs(stage_dir: Path) -> list[str]:
    if not stage_dir.exists():
        return []
    root = stage_dir.parent
    return sorted(path.relative_to(root).as_posix() for path in stage_dir.rglob("*") if path.is_file() and path.name not in {"stage_meta.json"} and path.stat().st_size <= 20 * 1024 * 1024)


def _summary(stage_dir: Path, stage: str, outputs: list[str]) -> str:
    report = stage_dir / "stage_report.md"
    if report.exists():
        text = report.read_text(encoding="utf-8", errors="replace").strip()
        return text[:1000]
    return f"{STAGE_LABELS[stage]}完成，登记 {len(outputs)} 个阶段产物。"


def _card_kind(stage: str) -> str:
    return {"plan": "question", "search": "literature", "read": "literature", "synthesize": "hypothesis", "design": "experiment", "code": "experiment", "run": "result", "report": "conclusion"}[stage]


def _artifact_kind(path: Path, stage: str) -> str:
    # Every stage emits a report.md checkpoint; only the final report-stage file is
    # the user-facing research report. Earlier files remain stage notes.
    if path.name == "report.md" and stage == "report": return "report"
    if path.suffix in {".py", ".toml", ".yaml", ".yml"}: return "code"
    if "result" in path.name or "metric" in path.name: return "metrics"
    if path.suffix in {".json", ".jsonl", ".csv"}: return "dataset"
    if path.name in {"stdout.txt", "stderr.txt"}: return "log"
    return "note"


def _artifact_id(run_id: str, relative: str) -> str:
    return f"ar_{hashlib.sha1(f'{run_id}:{relative}'.encode()).hexdigest()[:24]}"


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _small_text(path: Path) -> str | None:
    if path.stat().st_size > 256_000 or path.suffix.lower() in {".pdf", ".png", ".jpg", ".jpeg", ".sqlite", ".db"}:
        return None
    try:
        return path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        return None


def _project_asset(db: sqlite3.Connection, run: dict[str, Any], artifact_id: str, path: Path, stage: str, now: str) -> None:
    kind = "experiment" if stage in {"design", "code", "run"} else "paper" if stage in {"search", "read"} else "note"
    db.execute(
        "INSERT INTO wb_assets (id, project_id, kind, title, meta, status, tags_json, question_ids_json, hypothesis_ids_json, updated_at) "
        "VALUES (?, ?, ?, ?, ?, 'analyzed', ?, '[]', '[]', ?) ON CONFLICT(id) DO UPDATE SET meta=excluded.meta, updated_at=excluded.updated_at",
        (artifact_id, run["project_id"], kind, path.name, f"SimpleAutoResearch · {stage} · {path.stat().st_size} bytes", json.dumps(["自动研究", stage], ensure_ascii=False), now),
    )


def _project_experiment(db: sqlite3.Connection, run: dict[str, Any], run_dir: Path, now: str) -> None:
    results_path = run_dir / "07-run" / "results.json"
    stdout_path = run_dir / "07-run" / "stdout.txt"
    stderr_path = run_dir / "07-run" / "stderr.txt"
    try:
        results: Any = json.loads(results_path.read_text(encoding="utf-8")) if results_path.exists() else {}
    except (json.JSONDecodeError, OSError):
        results = {}
    metrics = results.get("metrics", results) if isinstance(results, dict) else {}
    stdout = _small_text(stdout_path) if stdout_path.exists() else ""
    stderr = _small_text(stderr_path) if stderr_path.exists() else ""
    db.execute(
        "INSERT INTO research_experiments (id, run_id, project_id, title, round, status, hypothesis, metrics_json, stdout, stderr, code_ref, created_at, updated_at) "
        "VALUES (?, ?, ?, ?, ?, 'passed', NULL, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET status='passed', metrics_json=excluded.metrics_json, stdout=excluded.stdout, stderr=excluded.stderr, updated_at=excluded.updated_at",
        (f"exp_{run['id']}_{run.get('attempt', 1)}", run["id"], run["project_id"], f"自动研究实验 #{run.get('attempt', 1)}", run.get("attempt", 1), json.dumps(metrics, ensure_ascii=False), stdout or "", stderr or "", "06-code", now, now),
    )
