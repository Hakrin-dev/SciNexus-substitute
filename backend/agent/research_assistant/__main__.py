"""多智能体科研助手 CLI 入口（暂无前端）。"""
from __future__ import annotations

import argparse
import json

from research_assistant.graph import build_graph


def main() -> None:
    parser = argparse.ArgumentParser(description="多智能体科研助手（LangGraph）")
    parser.add_argument("query", nargs="?", default="帮我分析Transformer领域近五年的研究趋势",
                        help="自然语言科研需求")
    parser.add_argument("--no-checkpoint", action="store_true", help="不启用会话检查点")
    args = parser.parse_args()

    graph = build_graph(checkpoint=not args.no_checkpoint)

    initial = {
        "user_query": args.query,
        "plan_index": 0,
        "working_memory": {"session_context": [], "evidence_chain_index": {"paper_ids": []}, "agent_outputs": {}},
    }

    config = {"configurable": {"thread_id": "cli-session-1"}} if not args.no_checkpoint else None
    result = graph.invoke(initial, config=config)

    print("=" * 60)
    print("意图识别:", result.get("intent"))
    print("任务计划:", result.get("task_plan"))
    print("-" * 60)
    print(result.get("final_response", ""))
    print("-" * 60)
    print("证据链论文:", result.get("working_memory", {}).get("evidence_chain_index", {}).get("paper_ids"))
    print("=" * 60)


if __name__ == "__main__":
    main()
