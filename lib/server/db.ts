/**
 * 研枢后端 SQLite 数据库层
 * 参考旧项目 server/store.py，将用户数据持久化到 SQLite
 * 使用 better-sqlite3（同步 API，适合 Next.js Route Handler）
 */
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { hashPassword } from "./password";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 数据库文件存放位置：项目根目录 /data/yanshu.db
const DATA_DIR = path.resolve(__dirname, "../../..", "data");
const DB_PATH = path.join(DATA_DIR, "yanshu.db");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let dbInstance: Database.Database | null = null;

export function getDB(): Database.Database {
  if (!dbInstance) {
    dbInstance = new Database(DB_PATH);
    dbInstance.pragma("journal_mode = WAL");
    dbInstance.pragma("foreign_keys = ON");
    initSchema(dbInstance);
    runMigrations(dbInstance);
  }
  return dbInstance;
}

function initSchema(db: Database.Database) {
  db.exec(`
    -- 用户表
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      avatar_color TEXT DEFAULT '#5046E5',
      token_version INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    -- 论文表（Feed流用）
    CREATE TABLE IF NOT EXISTS papers (
      id TEXT PRIMARY KEY,
      date TEXT,
      venue TEXT,
      venue_tone TEXT DEFAULT 'violet',
      authors TEXT,
      title TEXT NOT NULL,
      abstract TEXT,
      ai_link TEXT DEFAULT 'AI 深度解读',
      tags_json TEXT DEFAULT '[]',
      likes INTEGER DEFAULT 0,
      citations INTEGER DEFAULT 0,
      thumb TEXT,
      ccf TEXT,
      year INTEGER,
      doi TEXT,
      institute TEXT
    );

    -- 学者表
    CREATE TABLE IF NOT EXISTS scholars (
      id TEXT PRIMARY KEY,
      name_cn TEXT,
      name_en TEXT,
      initials TEXT,
      avatar_color TEXT,
      role TEXT,
      affiliation TEXT,
      bio TEXT,
      citations TEXT,
      citation_count INTEGER DEFAULT 0,
      h_index INTEGER DEFAULT 0,
      tags_json TEXT DEFAULT '[]',
      location TEXT,
      email TEXT
    );

    -- 学者发表论文
    CREATE TABLE IF NOT EXISTS scholar_publications (
      id TEXT PRIMARY KEY,
      scholar_id TEXT NOT NULL,
      title TEXT,
      abstract TEXT,
      authors TEXT,
      venue TEXT,
      citations TEXT,
      citations_short TEXT,
      FOREIGN KEY (scholar_id) REFERENCES scholars(id) ON DELETE CASCADE
    );

    -- 学者年引用数据
    CREATE TABLE IF NOT EXISTS scholar_yearly_citations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scholar_id TEXT NOT NULL,
      year TEXT NOT NULL,
      value INTEGER NOT NULL,
      FOREIGN KEY (scholar_id) REFERENCES scholars(id) ON DELETE CASCADE
    );

    -- 机构表
    CREATE TABLE IF NOT EXISTS institutions (
      id TEXT PRIMARY KEY,
      name_cn TEXT,
      name_en TEXT,
      initials TEXT,
      logo_color TEXT,
      type TEXT CHECK(type IN ('高校','研究院','企业实验室')),
      location TEXT,
      intro TEXT,
      stats_json TEXT DEFAULT '[]',
      fields_json TEXT DEFAULT '[]',
      highlight TEXT,
      bookmarked INTEGER DEFAULT 0,
      rank INTEGER,
      papers_per_year INTEGER
    );

    -- 投稿目标（会议/期刊）
    CREATE TABLE IF NOT EXISTS venues (
      id TEXT PRIMARY KEY,
      kind TEXT CHECK(kind IN ('conference','journal')),
      abbr TEXT,
      full_name TEXT,
      badges_json TEXT DEFAULT '[]',
      meta_rows_json TEXT DEFAULT '[]',
      chips_json TEXT DEFAULT '[]',
      accent TEXT DEFAULT 'success',
      deadline_label TEXT,
      deadline_date TEXT,
      deadline_offset_ms INTEGER,
      domain TEXT,
      acceptance_rate REAL,
      match_pct INTEGER
    );

    -- 知识库文件夹
    CREATE TABLE IF NOT EXISTS library_folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      count INTEGER DEFAULT 0,
      active INTEGER DEFAULT 0,
      UNIQUE(user_id, name),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- 知识库文献
    CREATE TABLE IF NOT EXISTS library_items (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      paper_id TEXT,
      title TEXT,
      venue TEXT,
      arxiv TEXT,
      authors TEXT,
      added_at TEXT DEFAULT (datetime('now', 'localtime')),
      pdf_tone TEXT DEFAULT 'violet',
      folder TEXT DEFAULT '默认',
      tags_json TEXT DEFAULT '[]',
      status TEXT DEFAULT 'unread',
      reading_progress INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- 项目表
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT,
      tagline TEXT,
      status TEXT CHECK(status IN ('进行中','已完成','已搁置')),
      progress INTEGER DEFAULT 0,
      created_at TEXT,
      owner TEXT,
      overview_json TEXT DEFAULT '[]',
      tech_stack_json TEXT DEFAULT '[]',
      members_json TEXT DEFAULT '[]',
      links_json TEXT DEFAULT '[]',
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- 项目里程碑
    CREATE TABLE IF NOT EXISTS project_milestones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL,
      title TEXT,
      detail TEXT,
      status TEXT CHECK(status IN ('done','doing','todo')),
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    -- 知识图谱节点
    CREATE TABLE IF NOT EXISTS graph_nodes (
      id TEXT PRIMARY KEY,
      graph_type TEXT CHECK(graph_type IN ('public','private')),
      label_lines_json TEXT DEFAULT '[]',
      weight REAL DEFAULT 0,
      year INTEGER,
      title TEXT,
      authors TEXT,
      venue TEXT,
      citations TEXT,
      abstract TEXT,
      paper_id TEXT,
      layer TEXT CHECK(layer IN ('mine','folder'))
    );

    -- 知识图谱边
    CREATE TABLE IF NOT EXISTS graph_edges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      graph_type TEXT NOT NULL,
      source TEXT NOT NULL,
      target TEXT NOT NULL,
      strength REAL DEFAULT 0,
      cross_layer INTEGER DEFAULT 0
    );

    -- 图谱关联 ID 顺序
    CREATE TABLE IF NOT EXISTS graph_related_ids (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      graph_type TEXT NOT NULL,
      node_id TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0
    );

    -- 通知表
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT,
      title TEXT,
      desc TEXT,
      time TEXT,
      read INTEGER DEFAULT 0,
      icon TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- 对话历史
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT,
      preview TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- 对话消息
    CREATE TABLE IF NOT EXISTS conversation_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id TEXT NOT NULL,
      role TEXT CHECK(role IN ('user','assistant','system')),
      content TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      workflow_json TEXT,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    -- 关注学者
    CREATE TABLE IF NOT EXISTS followed_scholars (
      user_id TEXT NOT NULL,
      scholar_id TEXT NOT NULL,
      followed_at TEXT DEFAULT (datetime('now', 'localtime')),
      PRIMARY KEY (user_id, scholar_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (scholar_id) REFERENCES scholars(id) ON DELETE CASCADE
    );

    -- 收藏机构
    CREATE TABLE IF NOT EXISTS bookmarked_institutions (
      user_id TEXT NOT NULL,
      institution_id TEXT NOT NULL,
      bookmarked_at TEXT DEFAULT (datetime('now', 'localtime')),
      PRIMARY KEY (user_id, institution_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE
    );
  `);
}

/**
 * 轻量迁移：为旧库补齐新增列与全文索引，避免破坏已有数据。
 * 新库由 initSchema 直接建表，此处对旧库做增量补齐。
 */
function runMigrations(db: Database.Database) {
  ensureColumn(db, "users", "token_version", "token_version INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "scholars", "citation_count", "citation_count INTEGER DEFAULT 0");

  // 迁移旧的无盐 SHA-256 demo 密码为 PBKDF2 格式（密码已知为 "yanshu123"）
  const demo = db
    .prepare("SELECT id, password_hash FROM users WHERE username = ?")
    .get("hankairun") as any;
  if (demo && !String(demo.password_hash).includes(":")) {
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(
      hashPassword("yanshu123"),
      demo.id
    );
    console.log("[db] 已将 demo 用户密码迁移为 PBKDF2 格式");
  }

  // FTS5 全文索引（可选能力，缺失时搜索回退到全表扫描）
  try {
    db.exec(
      `CREATE VIRTUAL TABLE IF NOT EXISTS papers_fts USING fts5(id UNINDEXED, title, abstract, tags);`
    );
    // 旧库升级：FTS 为空时从 papers 表回填
    const ftsCount = (db.prepare("SELECT COUNT(*) as n FROM papers_fts").get() as any).n;
    if (ftsCount === 0) {
      const papers = db
        .prepare("SELECT id, title, abstract, tags_json FROM papers")
        .all() as any[];
      const insertFts = db.prepare(
        "INSERT INTO papers_fts (id, title, abstract, tags) VALUES (?, ?, ?, ?)"
      );
      db.transaction(() => {
        for (const p of papers) {
          insertFts.run(p.id, p.title, p.abstract, jsonParse(p.tags_json, []).join(" "));
        }
      })();
    }
  } catch (e) {
    console.warn("[db] FTS5 不可用，搜索将回退到全表扫描：", (e as Error).message);
  }
}

function columnExists(db: Database.Database, table: string, column: string): boolean {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as any[];
  return cols.some((c) => c.name === column);
}

function ensureColumn(db: Database.Database, table: string, column: string, ddl: string): void {
  if (!columnExists(db, table, column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

// 工具函数
export function jsonParse<T = any>(str: string | null, fallback: T): T {
  if (!str) return fallback;
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}

export function jsonStringify(obj: any): string {
  return JSON.stringify(obj, null, 0);
}

/** 论文列表项序列化（papers 列表 / 推荐 / 搜索 共用） */
export function mapPaper(r: any) {
  return {
    id: r.id,
    date: r.date,
    venue: r.venue,
    venueTone: r.venue_tone,
    authors: r.authors,
    title: r.title,
    abstract: r.abstract,
    aiLink: r.ai_link,
    tags: jsonParse<string[]>(r.tags_json, []),
    likes: r.likes,
    citations: r.citations,
    thumb: r.thumb,
  };
}

/** 知识图谱节点序列化（公域 / 私域 共用） */
export function mapGraphNode(r: any) {
  return {
    id: r.id,
    labelLines: jsonParse<[string, string]>(r.label_lines_json, ["", ""]),
    weight: r.weight,
    year: r.year,
    title: r.title,
    authors: r.authors,
    venue: r.venue,
    citations: r.citations,
    abstract: r.abstract,
    paperId: r.paper_id,
    layer: r.layer,
  };
}
