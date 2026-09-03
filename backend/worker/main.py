from __future__ import annotations

import argparse
import json
import os
import socket
import sys
import time
import traceback
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[2]
ENGINE_SRC = REPO_ROOT / "backend" / "auto_research" / "src"
if str(ENGINE_SRC) not in sys.path:
    sys.path.insert(0, str(ENGINE_SRC))

from simple_ar.core.pipeline import Context, PipelineEvent, PipelineRunner  # noqa: E402
from simple_ar.core.stages import STAGE_SEQUENCE, STAGE_SLUGS, Stage  # noqa: E402
from simple_ar.pipeline_stages.registry import HANDLERS  # noqa: E402

from .projector import project_stage  # noqa: E402
from .store import RunStore  # noqa: E402


PROGRESS_AFTER_STAGE = {stage: round(int(stage) / len(STAGE_SEQUENCE) * 100) for stage in STAGE_SEQUENCE}


class WorkbenchReporter:
    def __init__(self, store: RunStore, run: dict[str, Any]) -> None:
        self.store = store
        self.run = run

    def __call__(self, event: PipelineEvent) -> None:
        stage = STAGE_SLUGS[event.stage] if event.stage else "plan"
        kind = "error" if event.name.endswith("failed") else "log"
        level = "error" if kind == "error" else "info"
        payload = {"name": event.name, "engineStage": stage, **event.data}
        self.store.event(self.run, kind, event.message, payload, level=level)


def worker_config(row: dict[str, Any]) -> dict[str, object]:
    try:
        supplied = json.loads(row.get("config_json") or "{}")
    except json.JSONDecodeError:
        supplied = {}
    profile = str(supplied.get("research_profile") or "standard") if isinstance(supplied, dict) else "standard"
    profile_defaults = {
        "fast": {"max_papers": 4, "llm_max_workers": 4, "experiment_timeout_sec": 60},
        "standard": {"max_papers": 12, "llm_max_workers": 3, "experiment_timeout_sec": 120},
        "deep": {"max_papers": 24, "llm_max_workers": 4, "experiment_timeout_sec": 300, "strict_search": True},
    }.get(profile, {})
    defaults: dict[str, object] = {
        "use_llm": os.getenv("AUTO_RESEARCH_LLM_ENABLED", "true").lower() in {"1", "true", "yes", "on"},
        "allow_llm_fallback": True,
        # 无 API Key 或上游暂时不可用时，代码阶段生成确定性的可执行基线，
        # 避免研究流程永久终止在 63%。调用方仍可显式设为 False 以执行严格模式。
        "allow_planning_fallback": True,
        "mode": "llm",
        "use_arxiv": os.getenv("AUTO_RESEARCH_OFFLINE", "false").lower() not in {"1", "true", "yes", "on"},
        "allow_fixture_fallback": True,
        "strict_search": False,
        "max_papers": 12,
        "llm_max_workers": 3,
        "experiment_template": "greenfield_project",
        "experiment_timeout_sec": 120,
        "report_mode": "auto",
        "use_retrieval": True,
        "retrieval_top_k": 10,
    }
    defaults.update(profile_defaults)
    defaults.update(supplied if isinstance(supplied, dict) else {})
    return defaults


def execution_mode(config: dict[str, object]) -> str:
    """Expose whether a successful run used live providers or deterministic fallbacks."""
    has_llm_key = bool(os.getenv("OPENAI_API_KEY") or os.getenv("LLM_API_KEY"))
    live_llm = bool(config.get("use_llm")) and has_llm_key
    live_search = bool(config.get("use_arxiv"))
    if live_llm and live_search:
        return "full"
    if live_llm or live_search:
        return "degraded"
    return "offline"


def execute(store: RunStore, run: dict[str, Any], runs_root: Path, worker_id: str) -> None:
    run_dir = (runs_root / str(run["project_id"]) / str(run["id"])).resolve()
    if runs_root.resolve() not in run_dir.parents:
        raise ValueError("Unsafe research run directory")
    run_dir.mkdir(parents=True, exist_ok=True)
    with store.connect() as db:
        db.execute("UPDATE research_runs SET run_dir = ?, worker_id = ? WHERE id = ?", (str(run_dir), worker_id, run["id"]))
    config = worker_config(run)
    reporter = WorkbenchReporter(store, run)
    handlers = {Stage(number): handler for number, handler in HANDLERS.items()}
    start_name = str(run.get("engine_stage") or "plan")
    start_index = _next_stage_index(run_dir, start_name)

    for stage in STAGE_SEQUENCE[start_index:]:
        if store.apply_control(run):
            return
        instructions = store.consume_instructions(run, run_dir)
        if instructions:
            config["user_instructions"] = instructions
        slug = STAGE_SLUGS[stage]
        before = max(0, PROGRESS_AFTER_STAGE[stage] - round(100 / len(STAGE_SEQUENCE)))
        store.checkpoint(run, slug, before, f"开始「{slug}」阶段")
        ctx = Context(run_dir=run_dir, topic=str(run["objective"]), config=config, reporter=reporter)
        PipelineRunner(handlers, reporter=reporter).run(ctx, from_stage=stage, to_stage=stage)
        project_stage(store.db_path, run, run_dir, slug)
        store.checkpoint(run, slug, PROGRESS_AFTER_STAGE[stage], f"完成「{slug}」阶段")

    mode = execution_mode(config)
    reason = "八阶段产物与报告均已生成"
    if mode != "full":
        reason += "；部分外部能力不可用，已使用可复现的降级策略"
    decision = {"action": "accept", "reason": reason, "attempt": int(run.get("attempt") or 1), "progressed": True, "executionMode": mode}
    store.finish(run, decision)


def _next_stage_index(run_dir: Path, fallback: str) -> int:
    """Resume at the first incomplete stage instead of rerunning the last checkpoint."""
    state_path = run_dir / "state.json"
    if state_path.exists():
        try:
            state = json.loads(state_path.read_text(encoding="utf-8"))
            for index, stage in enumerate(STAGE_SEQUENCE):
                stage_state = state.get(STAGE_SLUGS[stage], {})
                if not isinstance(stage_state, dict) or stage_state.get("status") != "completed":
                    return index
            return len(STAGE_SEQUENCE)
        except (json.JSONDecodeError, OSError):
            pass
    return next((index for index, stage in enumerate(STAGE_SEQUENCE) if STAGE_SLUGS[stage] == fallback), 0)


def run_forever(db_path: Path, runs_root: Path, *, once: bool, poll_seconds: float, run_id: str | None = None) -> int:
    store = RunStore(db_path)
    worker_id = f"{socket.gethostname()}:{os.getpid()}"
    while True:
        run = store.claim_next(worker_id, run_id)
        if run is None:
            if once:
                return 0
            time.sleep(poll_seconds)
            continue
        try:
            execute(store, run, runs_root, worker_id)
        except Exception as exc:  # worker boundary: persist full diagnostic before continuing
            stage = str((store.get(run["id"]) or run).get("engine_stage") or "plan")
            store.fail(run, stage, f"{exc}\n{traceback.format_exc()}")
        if once:
            return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="SciNexus SimpleAutoResearch worker")
    parser.add_argument("--db", type=Path, default=Path(os.getenv("SCINEXUS_DB_PATH", REPO_ROOT / "data" / "yanshu.db")))
    parser.add_argument("--runs-root", type=Path, default=Path(os.getenv("AUTO_RESEARCH_RUNS_ROOT", REPO_ROOT / "data" / "research-runs")))
    parser.add_argument("--once", action="store_true")
    parser.add_argument("--run-id", help="只领取指定的排队任务（本地开发自动调度使用）")
    parser.add_argument("--poll-seconds", type=float, default=2.0)
    args = parser.parse_args()
    if not args.db.exists():
        parser.error(f"Database does not exist: {args.db}. Start the web app once to initialize it.")
    return run_forever(args.db.resolve(), args.runs_root.resolve(), once=args.once, poll_seconds=max(0.2, args.poll_seconds), run_id=args.run_id)


if __name__ == "__main__":
    raise SystemExit(main())
