"""SQLite 论文/会议库：确定的数据承载层（论文元数据 + 会议库）。"""
from __future__ import annotations

import json
import os
import sqlite3
from threading import RLock
from typing import Any


class PaperStore:
    """SQLite 存储：papers 表 + venues 表，提供检索与查询接口。"""

    def __init__(self, db_path: str, papers: list[dict], venues: list[dict]) -> None:
        self.db_path = db_path
        self._lock = RLock()
        self.conn = sqlite3.connect(db_path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self._init_schema()
        self._upsert(papers, venues)

    def _init_schema(self) -> None:
        with self._lock, self.conn:
            self.conn.execute(
                """
                CREATE TABLE IF NOT EXISTS papers (
                    paper_id TEXT PRIMARY KEY,
                    title TEXT, author TEXT, year INTEGER, venue TEXT, ccf TEXT,
                    citation_count INTEGER, abstract TEXT, keywords TEXT,
                    heat TEXT, match_label TEXT, doi TEXT, institute TEXT,
                    arxiv_id TEXT, references_json TEXT
                )
                """
            )
            self.conn.execute(
                """
                CREATE TABLE IF NOT EXISTS venues (
                    venue_id TEXT PRIMARY KEY, name TEXT, ccf TEXT, full_name TEXT,
                    deadline TEXT, rate REAL, match_pct INTEGER, domain TEXT, location TEXT
                )
                """
            )
            self.conn.execute(
                """
                CREATE TABLE IF NOT EXISTS paper_analysis (
                    paper_id TEXT PRIMARY KEY, analysis_json TEXT NOT NULL
                )
                """
            )

    def _upsert(self, papers: list[dict], venues: list[dict]) -> None:
        """全量替换：每次构建都以当前数据源为准，避免跨数据源残留。"""
        with self._lock, self.conn:
            self.conn.execute("DELETE FROM papers")
            self.conn.execute("DELETE FROM venues")
            self.conn.executemany(
                """
                INSERT INTO papers VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """,
                [
                    (
                        p["paper_id"], p["title"], p["author"], p["year"], p["venue"], p.get("ccf"),
                        p.get("citation_count", 0), p.get("abstract", ""),
                        json.dumps(p.get("keywords", []), ensure_ascii=False),
                        p.get("heat"), p.get("match_label"), p.get("doi"), p.get("institute"),
                        p.get("arxiv_id"), json.dumps(p.get("references", []), ensure_ascii=False),
                    )
                    for p in papers
                ],
            )
            self.conn.executemany(
                """
                INSERT INTO venues VALUES (?,?,?,?,?,?,?,?,?)
                """,
                [
                    (
                        v.get("venue_id", v["name"]), v["name"], v.get("ccf"), v.get("full_name"),
                        v.get("deadline"), v.get("rate"), v.get("match_pct", 0), v.get("domain"),
                        v.get("location"),
                    )
                    for v in venues
                ],
            )

    @staticmethod
    def _row_to_paper(row: sqlite3.Row) -> dict:
        return {
            "paper_id": row["paper_id"], "title": row["title"], "author": row["author"],
            "year": row["year"], "venue": row["venue"], "ccf": row["ccf"],
            "citation_count": row["citation_count"], "abstract": row["abstract"],
            "keywords": json.loads(row["keywords"] or "[]"),
            "heat": row["heat"], "match_label": row["match_label"], "doi": row["doi"],
            "institute": row["institute"], "arxiv_id": row["arxiv_id"],
            "references": json.loads(row["references_json"] or "[]"),
        }

    @classmethod
    def open(cls, db_path: str) -> "PaperStore":
        """只建库/连库，不写入 papers/venues：供批量入库脚本写结构化分析时复用真实库。

        与 __init__ 不同，这里只连接并初始化 schema（含 paper_analysis），
        绝不会触发 _upsert，因此不会清空或重写 papers/venues 两表。
        """
        self = cls.__new__(cls)
        self.db_path = db_path
        self._lock = RLock()
        self.conn = sqlite3.connect(db_path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self._init_schema()
        return self

    def save_structured_analysis(self, paper_id: str, analysis: dict) -> None:
        """按 paper_id 写/覆盖结构化分析；已存在则整体替换为最新内容。"""
        analysis_json = json.dumps(analysis, ensure_ascii=False)
        with self._lock, self.conn:
            self.conn.execute(
                """
                INSERT INTO paper_analysis (paper_id, analysis_json) VALUES (?, ?)
                ON CONFLICT(paper_id) DO UPDATE SET analysis_json=excluded.analysis_json
                """,
                (paper_id, analysis_json),
            )

    def load_structured_analysis(self, paper_id: str) -> dict | None:
        """读取某篇论文的结构化分析；无记录时返回 None。"""
        with self._lock:
            row = self.conn.execute(
                "SELECT analysis_json FROM paper_analysis WHERE paper_id=?", (paper_id,)
            ).fetchone()
        return json.loads(row["analysis_json"]) if row else None

    def all_analysis_ids(self) -> set[str]:
        """返回所有已有结构化分析记录的 paper_id 集合。"""
        with self._lock:
            rows = self.conn.execute("SELECT paper_id FROM paper_analysis").fetchall()
        return {row["paper_id"] for row in rows}

    @classmethod
    def load(cls, db_path: str) -> tuple[list[dict], list[dict]]:
        """只读已有 SQLite 库，返回 (papers, venues)；库不存在或为空则返回 ([], [])。"""
        if not os.path.exists(db_path):
            return [], []
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        try:
            papers = [cls._row_to_paper(r) for r in conn.execute("SELECT * FROM papers").fetchall()]
            venues = [
                {
                    "venue": r["name"], "name": r["name"], "ccf": r["ccf"],
                    "full_name": r["full_name"], "deadline": r["deadline"], "rate": r["rate"],
                    "match_pct": r["match_pct"], "domain": r["domain"], "location": r["location"],
                }
                for r in conn.execute("SELECT * FROM venues").fetchall()
            ]
            return papers, venues
        finally:
            conn.close()

    def search(self, query: str, top_k: int = 10, filters: dict | None = None) -> list[dict]:
        filters = filters or {}
        like = f"%{query}%"
        sql = """
            SELECT * FROM papers WHERE
                (title LIKE ? OR abstract LIKE ? OR venue LIKE ? OR keywords LIKE ?)
        """
        params: list[Any] = [like, like, like, like]

        # core_topics：对每个主题词做 OR 匹配（中文无空格，直接子串匹配更可靠）
        topics = [t for t in filters.get("core_topics") or [] if t]
        if topics:
            cond = " OR ".join(["(title LIKE ? OR abstract LIKE ? OR keywords LIKE ?)"] * len(topics))
            sql += f" AND ({cond})"
            for t in topics:
                params += [f"%{t}%", f"%{t}%", f"%{t}%"]

        year_range = filters.get("time_range")
        if year_range and len(year_range) == 2:
            sql += " AND year >= ? AND year <= ?"
            params += [year_range[0], year_range[1]]
        ccf = filters.get("ccf")
        if ccf:
            sql += " AND ccf = ?"
            params.append(ccf)
        if filters.get("venue"):
            sql += " AND venue LIKE ?"
            params.append(f"%{filters['venue']}%")
        if filters.get("domain"):
            sql += " AND (title LIKE ? OR abstract LIKE ?)"
            params += [f"%{filters['domain']}%", f"%{filters['domain']}%"]

        sql += " ORDER BY citation_count DESC LIMIT ?"
        params.append(top_k)
        with self._lock:
            rows = self.conn.execute(sql, params).fetchall()
        return [self._row_to_paper(r) for r in rows]

    def get_paper(self, paper_id: str) -> dict | None:
        with self._lock:
            row = self.conn.execute("SELECT * FROM papers WHERE paper_id=?", (paper_id,)).fetchone()
        return self._row_to_paper(row) if row else None

    def all_papers(self) -> list[dict]:
        with self._lock:
            rows = self.conn.execute("SELECT * FROM papers").fetchall()
        return [self._row_to_paper(r) for r in rows]

    def query_venues(self, query: str) -> list[dict]:
        like = f"%{query}%"
        with self._lock:
            rows = self.conn.execute(
                """
                SELECT * FROM venues WHERE name LIKE ? OR domain LIKE ? OR full_name LIKE ? OR ccf LIKE ?
                """,
                (like, like, like, like),
            ).fetchall()
            if not rows:
                rows = self.conn.execute("SELECT * FROM venues").fetchall()
        return [
            {
                "venue": r["name"], "name": r["name"], "ccf": r["ccf"], "full_name": r["full_name"],
                "deadline": r["deadline"], "rate": r["rate"], "match_pct": r["match_pct"],
                "domain": r["domain"], "location": r["location"],
            }
            for r in rows
        ]

    def close(self) -> None:
        with self._lock:
            self.conn.close()
