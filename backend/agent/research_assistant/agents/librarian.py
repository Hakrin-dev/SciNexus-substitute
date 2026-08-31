"""Librarian Agent（知识管家）：维护公域/私域知识图谱，共引关系计算与图谱渲染。"""
from __future__ import annotations

from research_assistant.agents.base import BaseAgent
from research_assistant.llm import LLMProvider
from research_assistant.schemas import GraphData, GraphEdge, GraphNode, LibrarianOutput, LibrarianPlan
from research_assistant.tools import tools
from research_assistant.config import settings


def _remote_graph(seed_ids: list[str], depth: int) -> dict | None:
    """把远程 nodes/lines 转成 Librarian 的稳定 GraphData 契约。"""
    if settings.retrieval_provider not in ("remote", "hybrid") or not seed_ids:
        return None
    try:
        from research_assistant.integrations.retrieval_client import client

        node_map: dict[str, dict] = {}
        edge_map: dict[tuple[str, str, str], dict] = {}
        for seed_id in seed_ids[:3]:
            graph = client.get_graph(seed_id, depth)
            node_map.setdefault(seed_id, {
                "id": seed_id, "label": seed_id, "category": "seed", "read_priority": 1,
            })
            for raw in graph.get("nodes") or []:
                data = raw.get("data") if isinstance(raw.get("data"), dict) else {}
                node_id = str(raw.get("id") or raw.get("paper_id") or data.get("id") or "")
                node_type = str(raw.get("type") or data.get("type") or "PAPER").upper()
                title = str(raw.get("title") or data.get("title") or raw.get("label") or node_id)
                if not node_id or ("PAPER" not in node_type and not title):
                    continue
                node_map[node_id] = {
                    "id": node_id,
                    "label": title,
                    "category": "seed" if node_id in seed_ids else "related",
                    "read_priority": 1 if node_id in seed_ids else 2,
                }
            allowed = set(node_map)
            for line in graph.get("lines") or []:
                source, target = str(line.get("from") or ""), str(line.get("to") or "")
                if source not in allowed or target not in allowed:
                    continue
                raw_type = str(line.get("text") or (line.get("data") or {}).get("type") or "").upper()
                relation = {
                    "CITES": "cites",
                    "SAME_METHOD": "same_method",
                    "CO_CITED": "co-cited",
                    "CO-CITED": "co-cited",
                }.get(raw_type, "coupled")
                edge_map[(source, target, relation)] = {
                    "source": source, "target": target, "relation_type": relation,
                }
        return {"nodes": list(node_map.values()), "edges": list(edge_map.values())}
    except Exception:
        if not settings.retrieval_fallback_local:
            raise
        return None

SYSTEM_PROMPT = (
    "你是一位学术图谱分析师，负责构建和维护用户的私域知识库：\n"
    "\n"
    "【图谱构建】\n"
    "1. 共引关系：基于共同引用文献建立论文关联\n"
    "2. 书目耦合：根据参考文献重叠度计算相似度\n"
    "3. 作者网络：追踪合作者关系和研究团队演变\n"
    "4. 技术演进：绘制方法发展的时间线和分支路径\n"
    "\n"
    "【动态更新】\n"
    "- 实时监听用户阅读行为，静默抽取兴趣标签\n"
    "- 定期扫描新发表论文，自动推荐相关文献\n"
    "- 维护个人研究轨迹，识别能力成长曲线\n"
    "\n"
    "【禁止事项】\n"
    "严禁删除用户主动保存的重要文献；不得自动修改用户的个人标签和分类；禁止向第三方分享用户的阅读历史"
    "和兴趣偏好；不允许基于不完整信息做出错误的关联推荐；不得在图谱构建中引入有版权争议的文献。"
)


class LibrarianAgent(BaseAgent):
    name = "librarian"

    def __init__(self, llm: LLMProvider) -> None:
        super().__init__(llm)
        self.system_prompt = SYSTEM_PROMPT

    def run(self, state: dict) -> dict:
        query = state["user_query"]
        ev = (state.get("working_memory") or {}).get("evidence_chain_index") or {}
        seed_ids = [pid for pid in (ev.get("paper_ids") or []) if pid]

        # 阶段1. LLM 规划：选择图谱起点、关系类型与扩展深度（mock 回显确定性计划）
        plan: LibrarianPlan = self.generate(
            {"user_query": query, "available_seed_papers": seed_ids[:3]},
            LibrarianPlan,
            {"seed_paper_ids": seed_ids[:3], "graph_type": "co-citation", "depth": 2},
        )

        # 阶段2. 工具执行：基于 Seed 论文扩展共引/书目耦合关系
        graph = _remote_graph(plan.seed_paper_ids, plan.depth)
        if graph is None:
            graph = tools.call(
                "graph_expand",
                seed_ids=plan.seed_paper_ids,
                depth=plan.depth,
                relation=plan.graph_type,
            )

        nodes = [
            GraphNode(id=n["id"], label=n["label"], category=n["category"], read_priority=n.get("read_priority", 1))
            for n in graph["nodes"]
        ]
        edges = [GraphEdge(**e) for e in graph["edges"]]

        # 3. 计算节点中心度与创新差异，生成阅读优先度排序
        nodes.sort(key=lambda n: n.read_priority)
        read_order = [n.id for n in nodes[:5]]

        # 4. 输出供前端 D3.js/ReactFlow 渲染的 Node/Edge，并推荐私域分类标签。
        #    优化：跳过第②次 LLM 生成，直接用工具扩展出的图谱 + 确定性标签构造输出，
        #    避免 LLM 重新生成 graph_data 时幻觉/篡改节点。
        output = LibrarianOutput(
            status="SUCCESS",
            graph_data=GraphData(nodes=nodes, edges=edges),
            tags_recommendation=[f"seed:{n.label}" for n in nodes[:3]],
            folder_suggestion=(
                f"建议归档到「{query}」主题文件夹"
                if nodes
                else "未获得有效种子论文，暂不构建图谱；请先完成检索或选择论文。"
            ),
        )
        result = output.model_dump() | {"read_order": read_order}
        wm = self.remember(state, "build research graph", result, paper_ids=[n.id for n in nodes])
        return {"last_output": result, "working_memory": wm}
