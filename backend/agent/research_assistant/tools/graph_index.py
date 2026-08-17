"""图谱索引：基于引用关系与关键词相似度构建 networkx 图。

- CITES 边：论文 -> 其引用（来自数据源的 references，OpenAlex referenced_works 结构）
- same_method 边：共享关键词的两篇论文（书目耦合/主题相似）
- graph_expand：BFS 扩展 + 共引关系；graph_rag：子图中心度排序检索
"""
from __future__ import annotations

from typing import Any

import networkx as nx

from research_assistant.tools.text_utils import tokenize_query


class GraphIndex:
    def __init__(self, papers: list[dict]) -> None:
        self.papers = papers
        self._by_id = {p["paper_id"]: p for p in papers}
        self.graph = nx.DiGraph()
        self._build()

    def _build(self) -> None:
        for p in self.papers:
            self.graph.add_node(p["paper_id"], title=p.get("title", ""), category="paper")
        # CITES 边
        for p in self.papers:
            for ref in p.get("references", []):
                if ref in self._by_id:
                    self.graph.add_edge(p["paper_id"], ref, relation="cites")
        # same_method 边（共享关键词）
        for i in range(len(self.papers)):
            for j in range(i + 1, len(self.papers)):
                a, b = self.papers[i], self.papers[j]
                shared = set(a.get("keywords", [])) & set(b.get("keywords", []))
                if shared:
                    self.graph.add_edge(a["paper_id"], b["paper_id"], relation="same_method", shared=list(shared))

    # ------------------------------------------------------------------ #
    # graph_expand：BFS 扩展 + 共引/书目耦合
    # ------------------------------------------------------------------ #
    def expand(self, seed_ids: list[str], depth: int = 2, relation: str = "co-citation") -> dict:
        nodes: dict[str, dict] = {}
        edges: list[dict] = []
        valid_seed_ids = [seed for seed in seed_ids if seed in self._by_id and seed in self.graph]

        for seed in valid_seed_ids:
            nodes[seed] = {"id": seed, "label": self._by_id[seed]["title"],
                           "category": "seed", "read_priority": 1}

        frontier = set(valid_seed_ids)
        for _ in range(depth):
            nxt: set[str] = set()
            for sid in frontier:
                if sid not in self.graph:
                    continue
                neighbors = set(self.graph.successors(sid)) | set(self.graph.predecessors(sid))
                for nid in neighbors:
                    if nid not in self._by_id:
                        continue
                    if nid not in nodes:
                        nodes[nid] = {"id": nid, "label": self._by_id[nid]["title"],
                                      "category": "related", "read_priority": 0}
                    rel = self.graph.get_edge_data(sid, nid) or self.graph.get_edge_data(nid, sid) or {}
                    edges.append({"source": sid, "target": nid, "relation_type": rel.get("relation", "cites")})
                    nxt.add(nid)
            frontier = nxt
            if not frontier:
                break

        # 共引关系：被同一批论文共同引用的论文两两相连
        if relation in ("co-citation", "bibliographic_coupling"):
            for pair in self._co_referenced_pairs(valid_seed_ids):
                if pair[0] not in nodes or pair[1] not in nodes:
                    continue
                edges.append({"source": pair[0], "target": pair[1], "relation_type": "co-cited"})

        # read_priority：热度 + 引用数综合排序
        heat_rank = {"Hot": 0, "Warm": 1, "Cold": 2}
        for nid, node in nodes.items():
            p = self._by_id.get(nid, {})
            if node["category"] == "related":
                priority = heat_rank.get(p.get("heat"), 2) + 1
                priority += 0 if p.get("citation_count", 0) > 10000 else 1
                node["read_priority"] = int(priority)

        return {"nodes": list(nodes.values()), "edges": edges}

    def _co_referenced_pairs(self, seed_ids: list[str]) -> list[tuple[str, str]]:
        """计算与 seed 存在共引/耦合关系的论文对。"""
        refs_of_seeds: dict[str, set[str]] = {}
        for sid in seed_ids:
            p = self._by_id.get(sid)
            if p:
                refs_of_seeds[sid] = set(p.get("references", []))
        pairs: list[tuple[str, str]] = []
        ids = list(self._by_id)
        for i in range(len(ids)):
            for j in range(i + 1, len(ids)):
                a, b = ids[i], ids[j]
                a_refs = set(self._by_id[a].get("references", []))
                b_refs = set(self._by_id[b].get("references", []))
                if a_refs and b_refs and (a_refs & b_refs):
                    pairs.append((a, b))
        return pairs

    # ------------------------------------------------------------------ #
    # graph_rag：关键词种子 + 子图 PageRank/度数
    # ------------------------------------------------------------------ #
    def search(self, query: str, top_k: int = 10, filters: dict | None = None) -> list[dict[str, Any]]:
        tokens = tokenize_query(query)
        # 种子：标题/摘要/关键词命中
        seeds = []
        for pid, p in self._by_id.items():
            blob = " ".join([p.get("title", ""), p.get("abstract", ""), " ".join(p.get("keywords", []))]).lower()
            if tokens and any(t in blob for t in tokens):
                seeds.append(pid)

        sub = self.graph.subgraph(set(self.graph.nodes) & (set(seeds) | self._neighbors(seeds))).copy()
        if sub.number_of_nodes() == 0:
            return []
        try:
            pr = nx.pagerank(sub, weight=None)
        except nx.PowerIterationFailedConvergence:
            pr = {n: 1.0 for n in sub.nodes}
        scored = sorted(pr.items(), key=lambda kv: -kv[1])
        results = []
        for pid, sc in scored[:top_k]:
            p = self._by_id.get(pid)
            if not p:
                continue
            results.append({"paper_id": pid, "score": sc,
                            "title": p.get("title", ""), "venue": p.get("venue", ""),
                            "year": p.get("year", 0), "ccf": p.get("ccf"),
                            "heat": p.get("heat"), "citation_count": p.get("citation_count", 0)})
        return results

    def _neighbors(self, seeds: list[str]) -> set[str]:
        nbrs: set[str] = set()
        for s in seeds:
            if s not in self.graph:
                continue
            nbrs |= set(self.graph.successors(s)) | set(self.graph.predecessors(s))
        return nbrs

    # ------------------------------------------------------------------ #
    # get_paper_graph：以某论文为中心的引用子图（供前端知识图谱可视化）
    # ------------------------------------------------------------------ #
    @staticmethod
    def _short_name(p: dict) -> str:
        """节点短标签：第一作者姓_年份，缺作者用截断标题。"""
        author = (p.get("author") or "").strip()
        year = p.get("year") or ""
        if author:
            first = author.split(",")[0].strip().split(" ")[0] or author.split(",")[0].strip()
            return f"{first}_{year}" if year else first
        title = p.get("title") or ""
        return (title[:20] + "…") if len(title) > 20 else (title or p.get("paper_id", ""))

    def _paper_graph_node(self, pid: str) -> dict:
        p = self._by_id[pid]
        return {
            "id": pid,
            "name": self._short_name(p),
            "paperId": pid,
            "citations": p.get("citation_count", 0),
            "year": p.get("year", 0),
            "title": p.get("title", ""),
            "authors": p.get("author", ""),
            "venue": p.get("venue", ""),
            "abstract": p.get("abstract", ""),
        }

    def get_paper_graph(self, paper_id: str, max_each: int = 12) -> dict:
        """以某论文为中心的引用子图：前置（被引）、衍生（引用）、同主题邻居。

        返回前端 ECharts 图谱格式 {nodes, links, originPaper, priorWorks, derivativeWorks}；
        论文不存在时返回空结构。
        """
        if paper_id not in self._by_id:
            return {"nodes": [], "links": [], "originPaper": None,
                    "priorWorks": [], "derivativeWorks": []}

        prior: list[str] = []
        derivative: list[str] = []
        related: list[str] = []
        for nbr in self.graph.successors(paper_id):
            rel = self.graph.get_edge_data(paper_id, nbr, {}).get("relation")
            if rel == "cites":
                prior.append(nbr)
            elif rel == "same_method":
                related.append(nbr)
        for nbr in self.graph.predecessors(paper_id):
            rel = self.graph.get_edge_data(nbr, paper_id, {}).get("relation")
            if rel == "cites":
                derivative.append(nbr)
            elif rel == "same_method":
                related.append(nbr)

        prior = list(dict.fromkeys(prior))[:max_each]
        derivative = list(dict.fromkeys(derivative))[:max_each]
        seen = {paper_id, *prior, *derivative}
        related = [i for i in dict.fromkeys(related) if i not in seen][:max_each]

        nodes = [self._paper_graph_node(pid) for pid in [paper_id, *prior, *derivative, *related]]
        links: list[dict] = []
        for pid in prior:
            links.append({"source": paper_id, "target": pid, "relation": "cited"})
        for pid in derivative:
            links.append({"source": pid, "target": paper_id, "relation": "cites"})
        for pid in related:
            links.append({"source": paper_id, "target": pid, "relation": "related"})

        return {
            "nodes": nodes,
            "links": links,
            "originPaper": self._paper_graph_node(paper_id),
            "priorWorks": [self._paper_graph_node(pid) for pid in prior],
            "derivativeWorks": [self._paper_graph_node(pid) for pid in derivative],
        }
