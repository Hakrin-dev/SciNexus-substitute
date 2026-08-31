"""
研枢 YanShu — 后端 API 服务
@file        main.py
@version     3.0.0
@description 基于 FastAPI 的研枢科研平台后端服务，提供论文检索、AI对话、期刊管理、文献库、统计等 RESTful API。包含请求限流、全局异常处理、健康检查等生产级特性。
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import time
import random
import asyncio
import logging
import json
import uuid
import copy
from datetime import datetime
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
from typing import Optional, AsyncGenerator, Any
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from server.data.mock_data import (
    PAPERS, JOURNALS, CONVERSATIONS, LIBRARY_PAPERS,
    NOTIFICATIONS, TREND_DATA, FAVORITES_CACHE
)
from server.serializers import serialize_paper, serialize_venue, serialize_library_item
from server.data.scholars import SCHOLARS, SCHOLAR_DIRECTIONS, SCHOLAR_DETAILS
from server.data.institutions import INSTITUTIONS
from server.data.projects import PROJECTS, get_project
from server.data.graphs import PUBLIC_GRAPH, PRIVATE_GRAPH
from server.data.workbench import (
    WORKBENCH_OUTLINE, WORKBENCH_THREADS, WORKBENCH_CARDS,
    WORKBENCH_ASSETS, WORKBENCH_ACTIVITY, WORKBENCH_OVERVIEW, WORKBENCH_AGENT_TASKS,
)
from server import auth as auth_module

# ==================== Agent 网关（可选，默认启用） ====================
# 通过 AGENT_ENABLED=false 关闭；agent 依赖缺失时自动回退到 mock
try:
    from server.agent_gateway import (
        AGENT_ENABLED,
        search_papers as _agent_search,
        chat as _agent_chat,
        chat_with_meta as _agent_chat_with_meta,
        translate_text as _agent_translate,
        list_papers as _agent_papers,
        get_paper as _agent_get_paper,
        recommended_papers as _agent_recommended,
        get_structured as _agent_get_structured,
        get_fulltext as _agent_get_fulltext,
        match_venues as _agent_match_venues,
        get_paper_graph as _agent_get_paper_graph,
    )
except Exception as _import_err:  # pragma: no cover
    logger = None
    AGENT_ENABLED = False

    def _agent_search(*_a, **_k):
        raise RuntimeError("agent 网关不可用")

    def _agent_chat(*_a, **_k):
        raise RuntimeError("agent 网关不可用")

    def _agent_chat_with_meta(*_a, **_k):
        raise RuntimeError("agent 网关不可用")

    def _agent_translate(*_a, **_k):
        raise RuntimeError("agent 网关不可用")

    def _agent_papers(*_a, **_k):
        raise RuntimeError("agent 网关不可用")

    def _agent_get_paper(*_a, **_k):
        return None

    def _agent_recommended(*_a, **_k):
        raise RuntimeError("agent 网关不可用")

    def _agent_get_structured(*_a, **_k):
        return None

    def _agent_get_fulltext(*_a, **_k):
        raise RuntimeError("agent 网关不可用")

    def _agent_match_venues(*_a, **_k):
        raise RuntimeError("agent 网关不可用")

    def _agent_get_paper_graph(*_a, **_k):
        return {"nodes": [], "links": [], "originPaper": None, "priorWorks": [], "derivativeWorks": []}

START_TIME = time.time()

app = FastAPI(
    title="研枢 YanShu API",
    description="AI驱动科研全链路辅助平台后端服务",
    version="1.0.0"
)

# ==================== CORS 跨域配置 ====================
_cors_origins = [item.strip() for item in os.getenv("CORS_ALLOW_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",") if item.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== 日志配置 ====================
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

# ==================== 请求限流器 ====================
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ==================== 全局异常处理 ====================
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """全局未捕获异常处理器，记录错误日志并返回统一格式的 500 响应"""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": "Internal Server Error", "detail": str(exc) if os.getenv("NODE_ENV") != "production" else "请查看服务端日志", "path": str(request.url)}
    )

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """HTTP 异常处理器，将 FastAPI HTTPException 转为统一 JSON 格式"""
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail, "status_code": exc.status_code}
    )

# ==================== 健康检查 ====================
@app.get("/api/health")
def health_check():
    """服务健康检查：返回服务状态、版本、运行时间等基本信息"""
    return {
        "status": "healthy",
        "service": "研枢 YanShu API",
        "version": "1.0.0",
        "timestamp": time.time(),
        "uptime": time.time() - START_TIME
    }

@app.get("/api/health/detailed")
def detailed_health():
    """详细健康检查：除基本信息外，附加各数据集的条目数量"""
    return {
        "status": "healthy",
        "service": "研枢 YanShu API",
        "version": "1.0.0",
        "papers_count": len(PAPERS),
        "journals_count": len(JOURNALS),
        "conversations_count": len(CONVERSATIONS),
        "library_count": len(LIBRARY_PAPERS),
        "timestamp": time.time()
    }

# ==================== 请求/响应模型 ====================
class SearchRequest(BaseModel):
    """论文搜索请求"""
    query: str                              # 搜索关键词
    mode: Optional[str] = "keyword"         # 搜索模式：keyword（关键词）或 semantic（语义）
    ccf: Optional[str] = None               # CCF 级别筛选：A / B / C
    year_from: Optional[int] = None         # 发表年份下限
    year_to: Optional[int] = None           # 发表年份上限
    sort_by: Optional[str] = "relevance"    # 排序依据：relevance / citations / date
    task_type: Optional[str] = None           # 显式 Agent 任务类型
    conversation_id: Optional[str] = None     # 与后续深度任务共享的话题会话
    top_k: Optional[int] = None               # 返回候选论文数量上限（默认由后端决定）
    conference: Optional[list[str]] = None     # 会议筛选
    author: Optional[list[str]] = None         # 作者筛选
    keyword: Optional[list[str]] = None        # 关键词筛选
    subject: Optional[list[str]] = None        # 学科筛选

class ChatRequest(BaseModel):
    """AI 对话请求"""
    conversation_id: Optional[str] = None   # 对话ID，为空时创建新对话
    message: Optional[str] = None           # 用户消息内容
    messages: Optional[list[dict[str, Any]]] = None  # 前端/模型对话消息数组
    paper_id: Optional[str] = None          # 论文ID（论文问答/阅读场景定位论文）
    task_type: Optional[str] = None         # 显式 Agent 任务类型
    model: Optional[str] = None              # 模型路由：前端选择的具体模型名（未识别的值回退默认 LLM_MODEL）
    run_id: Optional[str] = None              # 单次任务运行 ID
    context: Optional[dict[str, Any]] = None  # 前序任务产出的结构化上下文
    mode: Optional[str] = None                # fast / deep
    style: Optional[str] = None               # 回答风格：头脑风暴 / 简明扼要 / 全面细致 / 严谨质疑（注入 finalize 提示词）

class TranslateRequest(BaseModel):
    """学术文本翻译请求"""
    text: str                                # 待翻译的学术文本
    target_lang: Optional[str] = "中文"       # 目标语言
    source_lang: Optional[str] = None        # 源语言（可选，提示模型用）

class SubmissionMatchRequest(BaseModel):
    """投稿匹配请求"""
    title: str                              # 论文标题
    abstract: str                           # 论文摘要
    keywords: Optional[list[str]] = None    # 论文关键词列表
    use_llm: bool = False                   # True=走 critic LLM 语义分析；False=纯关键词匹配（默认）

class LibraryAddRequest(BaseModel):
    """添加到文献库请求"""
    paper_id: str                           # 论文唯一标识
    folder: Optional[str] = "默认"          # 所属文件夹
    tags: Optional[list[str]] = None        # 标签列表

class FavRequest(BaseModel):
    """收藏请求"""
    paper_id: str                           # 论文唯一标识
    folder: Optional[str] = "默认"          # 所属文件夹
    tags: Optional[list[str]] = None        # 标签列表

class LoginRequest(BaseModel):
    """登录请求"""
    username: str                           # 用户名或邮箱
    password: str                           # 密码

class RegisterRequest(BaseModel):
    """注册请求"""
    username: str                           # 用户名
    password: str                           # 密码
    email: Optional[str] = None             # 邮箱（可选）
    displayName: Optional[str] = None       # 显示名（可选）

class FolderCreateRequest(BaseModel):
    """新建文献库文件夹请求"""
    name: str                               # 文件夹名称

class LibraryBatchDeleteRequest(BaseModel):
    """文献库批量删除请求"""
    ids: list[str]                          # 要删除的记录 ID 列表

class ProjectCreateRequest(BaseModel):
    """创建项目请求"""
    name: str                               # 项目名称
    tagline: Optional[str] = None           # 一句话简介
    status: Optional[str] = "进行中"        # 进行中 / 已完成 / 已搁置
    overview: Optional[list[str]] = None    # 项目概述段落
    techStack: Optional[list[str]] = None   # 技术栈
    milestones: Optional[list[dict]] = None # 里程碑列表
    members: Optional[list[dict]] = None    # 成员列表
    links: Optional[list[dict]] = None      # 链接列表

class ProjectUpdateRequest(BaseModel):
    """更新项目请求（字段均可选）"""
    name: Optional[str] = None
    tagline: Optional[str] = None
    status: Optional[str] = None
    progress: Optional[int] = None
    overview: Optional[list[str]] = None
    techStack: Optional[list[str]] = None
    milestones: Optional[list[dict]] = None
    members: Optional[list[dict]] = None
    links: Optional[list[dict]] = None

class ProposalRequest(BaseModel):
    """开题报告/综述生成请求"""
    type: Optional[str] = "review"          # proposal / review
    topic: Optional[str] = None             # 主题
    papers_count: Optional[int] = None      # 参考论文数

def _auth_header_token(request: Request) -> Optional[str]:
    """从 Authorization: Bearer <token> 提取 token。"""
    auth = request.headers.get("authorization") or ""
    parts = auth.split(" ")
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1].strip()
    return (parts[0] or "").strip() or None

def _chat_message(req: ChatRequest) -> str:
    """兼容前端 {message} 与模型式 {messages:[...]} 请求体。"""
    if req.message:
        return req.message
    for item in reversed(req.messages or []):
        if item.get("role") == "user" and item.get("content"):
            return str(item["content"])
    return ""

def _chat_history(req: ChatRequest) -> list[dict]:
    """从 {messages:[...]} 构建传给 agent 的多轮历史。

    排除最后一条用户消息（即当前问题），最多保留最近 12 轮；
    system 消息只保留最近一条并置于历史开头。
    """
    messages = req.messages or []
    last_user = None
    for index in range(len(messages) - 1, -1, -1):
        if messages[index].get("role") == "user" and messages[index].get("content"):
            last_user = index
            break
    if last_user is None:
        return []

    history: list[dict] = []
    system_msg: dict | None = None
    for item in messages[:last_user]:
        role = item.get("role")
        content = str(item.get("content") or "").strip()
        if not content:
            continue
        if role == "system":
            system_msg = {"role": "system", "content": content}
        elif role in ("user", "assistant"):
            history.append({"role": role, "content": content})
    if system_msg:
        history.insert(0, system_msg)
    # 最多保留最近 12 轮（24 条 user/assistant 消息）
    return history[-24:]

def _mock_workflow_meta(query: str, count: int, elapsed: float, mode: str = "keyword") -> dict:
    return {
        "query": query,
        "count": count,
        "search_time": elapsed,
        "mode": mode,
        "task_type": "paper_search",
        "agents": ["supervisor", "scout"],
        "workflow": {
            "steps": [
                {"agent": "supervisor", "action": "识别检索意图并授权检索工具", "status": "done"},
                {"agent": "scout", "action": "召回候选论文并计算相关度", "status": "done"},
            ]
        }
    }

class MemoryEntryCreateRequest(BaseModel):
    """新增 AI 记忆条目请求"""
    fact: str                               # 记忆的事实陈述(AI 视角第一人称)
    scope: str = "global"                   # global=全局生效;project=仅项目内生效
    project_id: Optional[str] = None        # scope=project 时的项目 ID
    project: Optional[str] = None           # 项目名(展示用)
    source: str = "手动"                    # 来源,如 "对话-2026-08-31" / "手动"

class MemoryEntryEditRequest(BaseModel):
    """编辑 AI 记忆条目请求"""
    fact: str

class MemorySettingsRequest(BaseModel):
    """AI 记忆总开关请求"""
    enabled: bool
# ==================== 根路径 ====================
@app.get("/")
def root():
    """API 根路径：返回服务信息和可用端点列表"""
    return {
        "service": "研枢 YanShu API",
        "version": "1.0.0",
        "docs": "/docs",
        "endpoints": {
            "papers": "/api/papers",
            "search": "/api/search",
            "chat": "/api/chat",
            "chat_stream": "/api/chat/stream",
            "journals": "/api/journals",
            "library": "/api/library",
            "notifications": "/api/notifications"
        }
    }

# ==================== 认证（登录 / 注册 / 当前用户） ====================
def _require_login(request: Request):
    """从请求解析当前用户；未登录抛 401。"""
    token = _auth_header_token(request)
    user_id = auth_module.get_current_user_id(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="请先登录")
    return user_id


# 私有状态必须按当前用户分桶。演示数据会在 startup 时仅初始化给 demo 用户。
_DEMO_LIBRARY = copy.deepcopy(LIBRARY_PAPERS)
_DEMO_CONVERSATIONS = copy.deepcopy(CONVERSATIONS)
_DEMO_NOTIFICATIONS = copy.deepcopy(NOTIFICATIONS)
_DEMO_PRIVATE_GRAPH = copy.deepcopy(PRIVATE_GRAPH)
_USER_LIBRARIES: dict[str, list[dict]] = {}
_USER_LIBRARY_FOLDERS: dict[str, list[dict]] = {}
_USER_CONVERSATIONS: dict[str, list[dict]] = {}
_USER_NOTIFICATIONS: dict[str, list[dict]] = {}
_USER_FAVORITES: dict[str, list[dict]] = {}
_USER_PRIVATE_GRAPHS: dict[str, dict] = {}
_USER_MEMORY_ENTRIES: dict[str, list[dict]] = {}
_USER_MEMORY_SETTINGS: dict[str, dict] = {}

# AI 长期记忆演示数据（与前端 lib/data/memory.ts memoryMock 对齐；仅播种演示账户）
_DEMO_MEMORY_ENTRIES: list[dict] = [
    {
        "id": "mem_m1",
        "fact": "用户的研究方向是机器人操作中的扩散策略,当前聚焦推理效率优化。",
        "source": "长上下文 Transformer 调研",
        "created_at": "2026-08-10T10:00:00+08:00",
        "scope": "global", "project_id": None, "project": None, "enabled": True,
    },
    {
        "id": "mem_m2",
        "fact": "用户偏好的论文呈现格式:先结论后论据,引用保留「编号. 标题(作者, 年份)」样式。",
        "source": "NeurIPS 2026 投稿筛选",
        "created_at": "2026-08-14T14:20:00+08:00",
        "scope": "global", "project_id": None, "project": None, "enabled": True,
    },
    {
        "id": "mem_m3",
        "fact": "用户正在准备 NeurIPS 2026 投稿,deadline 相关提醒应提高优先级。",
        "source": "NeurIPS 2026 投稿筛选",
        "created_at": "2026-08-16T09:05:00+08:00",
        "scope": "global", "project_id": None, "project": None, "enabled": True,
    },
    {
        "id": "mem_m4",
        "fact": "实验环境为单卡 RTX 4090,推荐方案时需考虑 24GB 显存约束。",
        "source": "扩散模型效率优化",
        "created_at": "2026-08-19T16:40:00+08:00",
        "scope": "project", "project_id": "scinexus", "project": "研枢", "enabled": True,
    },
    {
        "id": "mem_m5",
        "fact": "综述管线的实验数据统一放在 wb_assets 的 a2 数据集,引用时用版本号 v2。",
        "source": "扩散模型效率优化",
        "created_at": "2026-08-20T13:10:00+08:00",
        "scope": "project", "project_id": "scinexus", "project": "研枢", "enabled": True,
    },
    {
        "id": "mem_m6",
        "fact": "用户习惯用中文提问但希望术语保留英文原文。",
        "source": "操作泛化性研究计划",
        "created_at": "2026-08-21T11:30:00+08:00",
        "scope": "global", "project_id": None, "project": None, "enabled": True,
    },
]

_USER_FOLLOWED_SCHOLARS: dict[str, set[str]] = {}
_USER_BOOKMARKED_INSTITUTIONS: dict[str, set[str]] = {}


def _user_items(store: dict[str, list[dict]], user_id: str) -> list[dict]:
    return store.setdefault(user_id, [])


def _empty_private_graph() -> dict:
    return {"origin": None, "nodes": [], "edges": [], "relatedIds": []}


def _seed_demo_private_data(user_id: str) -> None:
    """仅演示账户继承原型数据；其他账户从空的私有空间开始。"""
    _USER_LIBRARIES.setdefault(user_id, copy.deepcopy(_DEMO_LIBRARY))
    _USER_CONVERSATIONS.setdefault(user_id, copy.deepcopy(_DEMO_CONVERSATIONS))
    _USER_NOTIFICATIONS.setdefault(user_id, copy.deepcopy(_DEMO_NOTIFICATIONS))
    _USER_PRIVATE_GRAPHS.setdefault(user_id, copy.deepcopy(_DEMO_PRIVATE_GRAPH))
    _USER_MEMORY_ENTRIES.setdefault(user_id, copy.deepcopy(_DEMO_MEMORY_ENTRIES))
    _USER_MEMORY_SETTINGS.setdefault(user_id, {"enabled": True})


def _require_production_auth_secret() -> None:
    if not auth_module.production_secret_configured():
        raise HTTPException(status_code=503, detail="生产认证密钥未配置")

@app.post("/api/auth/login")
def auth_login(req: LoginRequest):
    """用户登录：返回 token 与用户信息。"""
    _require_production_auth_secret()
    result = auth_module.login(req.username, req.password)
    if not result:
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    return {"success": True, "data": result}

@app.post("/api/auth/register")
def auth_register(req: RegisterRequest):
    """用户注册：成功返回 token 与用户信息，失败返回错误信息。"""
    _require_production_auth_secret()
    result = auth_module.register({
        "username": req.username,
        "password": req.password,
        "email": req.email,
        "displayName": req.displayName,
    })
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return {"success": True, "data": result}

@app.get("/api/auth/me")
def auth_me(request: Request):
    """获取当前登录用户信息（Bearer token）。"""
    user_id = _require_login(request)
    user = auth_module.get_user(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="未登录")
    return {"success": True, "data": user}

# ==================== 论文搜索 ====================
@app.get("/api/papers")
def get_papers(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    sort_by: str = Query("relevance"),
    ccf: Optional[str] = None,
    year: Optional[int] = None,
    keyword: Optional[str] = None,
):
    """
    获取论文列表（支持分页、筛选、排序）
    :param page:       页码（从1开始）
    :param page_size:  每页条数（1-50）
    :param sort_by:    排序方式：relevance（相关度） / citations（引用数） / date（日期）
    :param ccf:        CCF 级别筛选
    :param year:       发表年份筛选
    :param keyword:    标题/摘要/关键词模糊搜索
    :return:           分页后的论文列表及分页元信息
    """
    if AGENT_ENABLED:
        try:
            return _agent_papers(page, page_size)
        except Exception as exc:
            logger.warning(f"Agent 论文列表失败，回退 mock: {exc}")
    result = list(PAPERS)

    # 按 CCF 级别筛选
    if ccf and ccf != "all":
        result = [p for p in result if p["ccf"] == ccf]
    # 按年份筛选
    if year:
        result = [p for p in result if p["year"] == year]
    # 按关键词模糊搜索
    if keyword:
        kw = keyword.lower()
        result = [p for p in result if
            kw in p["title"].lower() or
            kw in p["abstract"].lower() or
            any(kw in k for k in p["keywords"])]

    # 排序逻辑
    if sort_by == "citations":
        result.sort(key=lambda p: int(p["citations"].replace(",","").replace("+","")), reverse=True)
    elif sort_by == "date":
        result.sort(key=lambda p: p["year"], reverse=True)
    else:
        # 相关度排序：完美匹配优先
        result.sort(key=lambda p: p["match"] == "perfect", reverse=True)

    total = len(result)
    start = (page - 1) * page_size
    end = start + page_size
    return {
        "data": [serialize_paper(p) for p in result[start:end]],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size
    }

@app.get("/api/papers/recommended")
def get_recommended(limit: int = Query(9, ge=1, le=20)):
    """
    获取每日推荐论文
    :param limit: 返回条数上限（1-20）
    :return:      按引用量排序的前 N 篇论文
    """
    if AGENT_ENABLED:
        try:
            return _agent_recommended(limit)
        except Exception as exc:
            logger.warning(f"Agent 每日推荐失败，回退 mock: {exc}")
    result = sorted(PAPERS, key=lambda p: int(p["citations"].replace(",","").replace("+","")), reverse=True)[:limit]
    return {"data": [serialize_paper(p) for p in result], "updated": "2026-07-23"}

@app.get("/api/papers/{paper_id}")
def get_paper_detail(paper_id: str):
    """
    根据论文 ID 获取论文详情
    :param paper_id: 论文唯一标识
    :return:        论文完整数据
    :raises HTTPException 404: 论文不存在
    """
    if AGENT_ENABLED:
        try:
            agent_paper = _agent_get_paper(paper_id)
            if agent_paper:
                return {"data": agent_paper}
        except Exception as exc:
            logger.warning(f"Agent 论文详情失败，回退 mock: {exc}")
    for p in PAPERS:
        if p["id"] == paper_id:
            # mock 论文也尝试附带结构化分析（若有 p*.pdf 处理产物）
            structured = None
            if AGENT_ENABLED:
                try:
                    structured = _agent_get_structured(paper_id)
                except Exception:
                    structured = None
            serialized = serialize_paper(p)
            if structured:
                serialized["structured"] = structured
            return {"data": serialized}
    raise HTTPException(status_code=404, detail="论文未找到")

@app.get("/api/papers/{paper_id}/fulltext")
def get_paper_fulltext(paper_id: str):
    """
    根据论文 ID 获取论文全文分块（真实 PDF 原文 / 摘要 + 结构化分析回退）。
    有 PDF 时 has_pdf=true，chunks 按页分组；否则 has_pdf=false 返回回退分块。
    :param paper_id: 论文唯一标识
    :return:        全文分块数据
    :raises HTTPException 404: 论文不存在或全文不可用
    """
    if AGENT_ENABLED:
        try:
            ft = _agent_get_fulltext(paper_id)
            if ft:
                return {"data": ft}
        except Exception as exc:
            logger.warning(f"Agent 论文全文失败，回退 404: {exc}")
    raise HTTPException(status_code=404, detail="论文未找到")

@app.get("/api/papers/{paper_id}/graph")
def get_paper_graph(paper_id: str):
    """
    获取某论文的引用图谱（PaperGraph 格式：origin / nodes / edges / relatedIds），
    供前端知识图谱页渲染。当前返回 mock 演示数据；真实 agent 图谱（旧 ECharts 格式）
    待前端格式统一后接入。
    """
    return {"data": PUBLIC_GRAPH}


@app.get("/api/knowledge/graph")
def get_knowledge_graph(request: Request):
    """获取私域知识图谱（我的发表 × 收藏论文 分层，PaperGraph 格式）。"""
    user_id = _require_login(request)
    return {"data": _USER_PRIVATE_GRAPHS.get(user_id, _empty_private_graph())}

@app.get("/api/graph/public")
def get_graph_public(paper_id: Optional[str] = None):
    """获取公域知识图谱（某论文的引用关系，PaperGraph 格式）。"""
    if paper_id and AGENT_ENABLED:
        try:
            return {"data": _agent_get_paper_graph(paper_id)}
        except Exception as exc:
            logger.warning(f"知识底座图谱失败，回退 mock: {exc}")
    return {"data": PUBLIC_GRAPH}


@app.get("/api/knowledge/health")
def get_knowledge_health():
    """检查远程知识底座主服务、检索服务和就绪状态。"""
    try:
        from research_assistant.config import settings
        from research_assistant.integrations.retrieval_client import client

        return {"success": True, "data": {**client.health(), "provider": settings.retrieval_provider}}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"知识底座暂不可用: {exc}") from exc

@app.get("/api/graph/private")
def get_graph_private(request: Request):
    """获取私域知识图谱（我的发表 × 收藏论文 分层，PaperGraph 格式）。"""
    user_id = _require_login(request)
    return {"data": _USER_PRIVATE_GRAPHS.get(user_id, _empty_private_graph())}

# ==================== 语义搜索 ====================
@app.post("/api/search")
@limiter.limit("10/minute")
async def search_endpoint(req: SearchRequest, request: Request):
    """
    AI 语义搜索接口（限流：10次/分钟）
    流程：意图分解 -> 候选召回 -> 逐篇验证
    :param req:     搜索请求体
    :param request: FastAPI Request 对象（限流器需要）
    :return:        语义搜索结果及搜索元信息
    """
    logger.info(f"Search: query='{req.query}', mode={req.mode}")
    if AGENT_ENABLED:
        try:
            result = _agent_search(
                req.query,
                top_k=req.top_k or 10,
                task_type=req.task_type,
                conversation_id=req.conversation_id,
                year_from=req.year_from,
                year_to=req.year_to,
                conferences=req.conference,
                authors=req.author,
                keywords=req.keyword,
                subjects=req.subject,
            )
            result.setdefault("conversation_id", req.conversation_id or f"conv_{uuid.uuid4().hex}")
            return result
        except Exception as exc:
            logger.warning(f"Agent 检索失败，回退 mock: {exc}")
    return _search_papers_impl(req)

def _search_papers_impl(req: SearchRequest):
    """
    语义搜索核心实现：
    1. 意图分解：将用户查询拆分为多个子查询
    2. 候选召回：基于关键词匹配从论文库中召回候选集
    3. 逐篇验证：为每篇候选论文计算匹配度分数
    """
    start_time = time.time()

    # 步骤一：意图分解
    sub_queries = _decompose_intent(req.query)
    checklist = _generate_checklist(req.query)

    # 步骤二：候选召回
    candidates = []
    for sq in sub_queries:
        for p in PAPERS:
            if any(kw.lower() in p["title"].lower() or kw.lower() in p["abstract"].lower()
                   for kw in sq["keywords"]):
                if p["id"] not in [c["id"] for c in candidates]:
                    candidates.append({**p, "match_reason": f"关键词匹配: {', '.join(sq['keywords'])}"})
    candidates = candidates[:20]

    # 步骤三：逐篇验证（模拟评分）
    for c in candidates:
        c["checklist_score"] = random.randint(60, 100)
        c["match"] = "perfect" if c["checklist_score"] >= 90 else \
                     "partial" if c["checklist_score"] >= 70 else "weak"
        c["matchLabel"] = "Perfect" if c["match"] == "perfect" else \
                          "Partial" if c["match"] == "partial" else "Weak"

    # 按匹配度降序排列
    candidates.sort(key=lambda c: c["checklist_score"], reverse=True)
    elapsed = round(time.time() - start_time, 2)
    workflow_meta = _mock_workflow_meta(req.query, len(candidates), elapsed, req.mode or "keyword")
    workflow_meta.update({
        "sub_queries": sub_queries,
        "checklist": checklist,
        "candidates_count": len(candidates),
    })

    return {
        "data": [serialize_paper(c) for c in candidates],
        "summary": _quick_summary(req.query, candidates),
        "meta": workflow_meta
    }

def _quick_summary(query: str, candidates: list) -> str:
    """为快速检索生成简易回答（agent 不可用时的兜底摘要，供前端 formatQuickAnswer 使用）。"""
    if not candidates:
        return f"针对「{query}」，未检索到相关论文。建议更换关键词后重试。"
    top = candidates[0]
    return (
        f"针对「{query}」，为你检索到 **{len(candidates)} 篇**候选论文。"
        f"其中与主题最相关的是「{top['title']}」（{top.get('venue') or '未知出处'}，"
        f"引用 {top.get('citations', 0)}），摘要与关键词匹配度最高，可作为切入点。"
    )

# ==================== AI 对话 ====================
@app.get("/api/conversations")
def list_conversations(request: Request):
    """获取全部对话历史列表（仅返回 id、标题和预览）"""
    user_id = _require_login(request)
    result = [{"id": c["id"], "title": c["title"], "preview": c["preview"]} for c in _user_items(_USER_CONVERSATIONS, user_id)]
    return {"data": result}

@app.get("/api/conversations/{conv_id}")
def get_conversation(conv_id: str, request: Request):
    """
    获取指定对话的完整详情
    :param conv_id: 对话唯一标识
    :return:        对话的完整数据
    :raises HTTPException 404: 对话不存在
    """
    user_id = _require_login(request)
    for c in _user_items(_USER_CONVERSATIONS, user_id):
        if c["id"] == conv_id:
            return {"data": c}
    raise HTTPException(status_code=404, detail="对话未找到")

def _generate_chat_reply(message: str, reason: str = "") -> str:
    """
    agent 不可用时的兜底回复（供普通接口和流式接口共用）。

    不伪造学术内容：仅保留真实可用的操作提示（如引导到论文搜索页），
    其余场景统一返回服务不可用的诚实说明。
    :param message: 用户输入的消息
    :param reason: 不可用原因（异常信息或 "agent 未启用"）
    :return:        生成的 AI 回复文本
    """
    reason = reason or "agent 未启用"
    if any(token in message for token in ("找", "推荐", "检索", "搜索")):
        return (
            "论文检索需要智能体服务在线，当前智能体服务不可用。"
            "您仍可使用页面上的论文搜索功能查看论文列表。"
        )
    return f"智能体服务暂时不可用：{reason}，请稍后重试或检查后端配置。"

@app.post("/api/chat")
@limiter.limit("30/minute")
async def chat_endpoint(req: ChatRequest, request: Request):
    """
    AI 对话（一次性返回完整回复，限流：30次/分钟）
    :param req:     对话请求体
    :param request: FastAPI Request 对象（限流器需要）
    :return:        AI 回复内容、对话 ID 和 token 数量
    """
    message = _chat_message(req)
    if not message:
        raise HTTPException(status_code=400, detail="消息不能为空")
    logger.info(f"Chat: conv={req.conversation_id}, msg_len={len(message)}")
    if AGENT_ENABLED:
        try:
            result = _agent_chat_with_meta(
                message,
                task_type=req.task_type or ("research_exploration" if req.mode == "deep" else None),
                paper_id=req.paper_id,
                history=_chat_history(req),
                model=req.model,
                conversation_id=req.conversation_id,
                run_id=req.run_id,
                context={**(req.context or {}), **({"style": req.style} if req.style else {})},
            )
            reply = result["reply"]
            return {
                "reply": reply,
                "conversation_id": result.get("conversation_id") or req.conversation_id,
                "run_id": result.get("run_id"),
                "tokens": len(reply),
                "workflow": result["workflow"],
                "generated_files": result["generated_files"],
                "references": result["references"],
            }
        except Exception as exc:
            logger.warning(f"Agent 对话失败，回退 mock: {exc}")
            return _chat_impl(ChatRequest(conversation_id=req.conversation_id, message=message), reason=str(exc))
    return _chat_impl(ChatRequest(conversation_id=req.conversation_id, message=message))

def _chat_impl(req: ChatRequest, reason: str = ""):
    """AI 对话核心实现（agent 不可用时的兜底）：生成诚实回复并一次性返回"""
    reply = _generate_chat_reply(req.message, reason=reason)

    return {
        "reply": reply,
        "conversation_id": req.conversation_id or "new",
        "run_id": None,
        "tokens": len(reply),
        "workflow": None,
        "generated_files": None,
        "references": None,
    }

@app.post("/api/chat/stream")
async def chat_stream(req: ChatRequest):
    """
    AI 对话流式接口（SSE 逐字发送回复，模拟打字效果）
    :param req: 对话请求体
    :return:    SSE 流式响应，包含 meta 事件、逐字 data 事件和 done 终止事件
    """
    message = _chat_message(req)
    if not message:
        raise HTTPException(status_code=400, detail="消息不能为空")
    conversation_id = req.conversation_id or f"conv_{uuid.uuid4().hex}"
    run_id = None
    if AGENT_ENABLED:
        try:
            result = _agent_chat_with_meta(
                message,
                task_type=req.task_type or ("research_exploration" if req.mode == "deep" else None),
                paper_id=req.paper_id,
                history=_chat_history(req),
                model=req.model,
                conversation_id=req.conversation_id,
                run_id=req.run_id,
                context={**(req.context or {}), **({"style": req.style} if req.style else {})},
            )
            reply = result["reply"]
            run_id = result.get("run_id")
            workflow = result["workflow"]
            generated_files = result["generated_files"]
            references = result["references"]
        except Exception as exc:
            logger.warning(f"Agent 对话失败，回退 mock: {exc}")
            reply = _generate_chat_reply(message, reason=str(exc))
            workflow = None
            generated_files = None
            references = None
    else:
        reply = _generate_chat_reply(message)
        workflow = None
        generated_files = None
        references = None

    async def event_generator() -> AsyncGenerator[str, None]:
        # 先发送对话元信息（含生成文件列表，便于右侧编辑区展示）
        conv_id = conversation_id
        meta = {
            "conversation_id": conv_id,
            "run_id": run_id,
            "tokens": len(reply),
            "workflow": workflow,
            "generated_files": generated_files,
            "references": references,
        }
        yield "event: meta\ndata: " + json.dumps(meta, ensure_ascii=False) + "\n\n"

        # 长回复按小块发送，避免代码/文档生成时右侧编辑区长时间空白。
        chunk_size = 12 if len(reply) > 800 else 1
        for i in range(0, len(reply), chunk_size):
            chunk = reply[i : i + chunk_size]
            payload = json.dumps({"choices": [{"delta": {"content": chunk}}]}, ensure_ascii=False)
            yield f"data: {payload}\n\n"
            delay = 0.006 if chunk_size > 1 else random.uniform(0.03, 0.06)
            await asyncio.sleep(delay)

        # 发送流结束信号
        yield "event: done\ndata: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )

# ==================== 学术文本翻译 ====================
def _validate_translate_text(req: TranslateRequest) -> str:
    """翻译接口共用校验：非空 + 长度上限，返回清洗后的文本。"""
    text = (req.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="文本不能为空")
    if len(text) > 8000:
        raise HTTPException(status_code=400, detail="文本过长")
    return text

def _agent_translate_or_raise(text: str, req: TranslateRequest) -> str:
    """调用 agent 翻译；不可用/异常时抛出 502，让前端能如实展示错误。"""
    if not AGENT_ENABLED:
        raise HTTPException(status_code=502, detail="翻译服务暂时不可用：agent 未启用")
    try:
        return _agent_translate(text, req.target_lang, req.source_lang)
    except Exception as exc:
        logger.error(f"翻译服务异常: {exc}")
        raise HTTPException(status_code=502, detail=f"翻译服务暂时不可用：{exc}") from exc

@app.post("/api/translate")
@limiter.limit("30/minute")
async def translate_endpoint(req: TranslateRequest, request: Request):
    """
    学术文本翻译（一次性返回完整译文，限流：30次/分钟）
    :param req:     翻译请求体
    :param request: FastAPI Request 对象（限流器需要）
    :return:        译文与目标语言
    """
    text = _validate_translate_text(req)
    logger.info(f"Translate: target={req.target_lang}, len={len(text)}")
    translated = _agent_translate_or_raise(text, req)
    return {"translated": translated, "target_lang": req.target_lang}

@app.post("/api/translate/stream")
async def translate_stream(req: TranslateRequest):
    """
    学术文本翻译流式接口（SSE 分块发送译文，模拟打字效果）
    :param req: 翻译请求体
    :return:    SSE 流式响应，包含 meta 事件、分块 data 事件和 done 终止事件
    """
    text = _validate_translate_text(req)
    logger.info(f"Translate stream: target={req.target_lang}, len={len(text)}")
    translated = _agent_translate_or_raise(text, req)

    async def event_generator() -> AsyncGenerator[str, None]:
        # 先发送翻译元信息
        meta = {
            "target_lang": req.target_lang,
            "tokens": len(translated),
        }
        yield "event: meta\ndata: " + json.dumps(meta, ensure_ascii=False) + "\n\n"

        # 长译文按小块发送，模拟打字效果
        chunk_size = 12 if len(translated) > 800 else 1
        for i in range(0, len(translated), chunk_size):
            chunk = translated[i : i + chunk_size]
            payload = json.dumps({"choices": [{"delta": {"content": chunk}}]}, ensure_ascii=False)
            yield f"data: {payload}\n\n"
            delay = 0.006 if chunk_size > 1 else random.uniform(0.03, 0.06)
            await asyncio.sleep(delay)

        # 发送流结束信号
        yield "event: done\ndata: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )
@app.get("/api/journals")
def get_journals(sort_by: str = Query("match")):
    """
    获取期刊/会议列表
    :param sort_by: 排序方式：match（匹配度） / rate（录用率） / deadline（截稿日期）
    :return:        排序后的期刊列表
    """
    result = list(JOURNALS)
    if sort_by == "rate":
        result.sort(key=lambda j: j["rate"], reverse=True)
    elif sort_by == "deadline":
        result.sort(key=lambda j: j["deadline"])
    else:
        result.sort(key=lambda j: j["matchPct"], reverse=True)
    return {"data": [serialize_venue(j) for j in result]}

@app.get("/api/venues")
def get_venues(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    keyword: Optional[str] = None,
    kind: Optional[str] = None,
    sort_by: str = Query("match"),
):
    """
    获取投稿目标（会议/期刊）列表 —— 前端 /api/venues 契约（带分页/搜索/类型筛选）。
    :param page:      页码
    :param page_size: 每页条数
    :param keyword:   名称/简称模糊搜索
    :param kind:      conference / journal
    :param sort_by:   match（匹配度）/ rate（录用率）/ deadline（截稿日期）
    """
    result = list(JOURNALS)
    if keyword:
        kw = keyword.lower()
        result = [j for j in result if
                  kw in (j.get("fullName") or j.get("full_name") or "").lower() or
                  kw in (j.get("abbr") or j.get("name") or "").lower()]
    if kind:
        result = [j for j in result if j.get("kind") == kind]
    if sort_by == "rate":
        result.sort(key=lambda j: j.get("rate", 0) or 0, reverse=True)
    elif sort_by == "deadline":
        result.sort(key=lambda j: (j.get("deadline") is None, j.get("deadline") or ""))
    else:
        result.sort(key=lambda j: j.get("matchPct", 0) or 0, reverse=True)

    total = len(result)
    start = (page - 1) * page_size
    end = start + page_size
    return {
        "data": [serialize_venue(j) for j in result[start:end]],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }

# 研究方向 → 代表性关键词（用于投稿方向匹配）
_DOMAIN_KEYWORDS: dict[str, list[str]] = {
    "计算机视觉": ["vision", "image", "图像", "视觉", "detection", "检测", "segmentation", "分割",
                   "recognition", "识别", "video", "视频", "object", "目标"],
    "自然语言处理": ["language", "nlp", "文本", "语言", "translation", "翻译", "transformer", "attention",
                     "语义", "semantic", "text", "generation", "生成", "llm", "大模型", "自然语言"],
    "机器学习": ["learning", "训练", "machine", "neural", "神经网络", "deep", "深度学习", "model", "模型",
                 "optimization", "优化", "regression", "回归", "classification", "分类", "reinforcement", "强化"],
    "人工智能": ["ai", "智能", "agent", "reasoning", "推理", "artificial", "人工智能", "decision", "决策",
                 "planning", "规划", "knowledge", "知识"],
}


def _venue_match_score(text: str, domain: str) -> int:
    """按方向关键词命中数计算投稿匹配分（30~95，命中越多越高）。"""
    terms = _DOMAIN_KEYWORDS.get(domain, [])
    hits = sum(1 for t in terms if t in text)
    return min(95, 35 + hits * 15) if hits else 30


@app.post("/api/submission/match")
def submit_match(req: SubmissionMatchRequest):
    """
    投稿方向匹配：根据论文标题/摘要/关键词，为每条期刊/会议计算匹配分数和理由。

    use_llm=True 时走 critic agent 的 LLM 语义分析（更细致，但慢）；默认 False
    走纯关键词确定性匹配（快、零 LLM）。LLM 失败时自动回退关键词匹配。
    """
    # LLM 语义分析模式（可选）
    if req.use_llm:
        try:
            result = _agent_match_venues(req.title, req.abstract, req.keywords or [])
            by_name = {j["name"]: j for j in JOURNALS}
            matched = []
            for v in result.get("recommended_venues", []):
                j = by_name.get(v.get("name", ""))
                if not j:
                    continue
                score = int(v.get("score", 0))
                matched.append({**j, "matchPct": score,
                    "matchClass": "high" if score >= 80 else "mid" if score >= 60 else "low",
                    "matchReason": result.get("match_reason") or f"LLM 推荐 {j['name']}"})
            if matched:
                matched.sort(key=lambda j: j["matchPct"], reverse=True)
                return {"data": [serialize_venue(j) for j in matched[:5]], "input": {"title": req.title, "keywords": req.keywords or []}, "mode": "llm"}
        except Exception as exc:
            logger.warning(f"LLM 投稿匹配失败，回退关键词匹配: {exc}")

    # 关键词匹配模式（默认）
    text = " ".join(filter(None, [req.title, req.abstract, " ".join(req.keywords or [])])).lower()
    matched = []
    for j in JOURNALS:
        domain = j.get("domain", "")
        score = _venue_match_score(text, domain)
        matched.append({**j, "matchPct": score,
            "matchClass": "high" if score >= 80 else "mid" if score >= 60 else "low",
            "matchReason": f"研究方向与{domain}领域相关" if score >= 60 else f"与{domain}方向契合度一般"})
    matched.sort(key=lambda j: j["matchPct"], reverse=True)
    return {
        "data": [serialize_venue(j) for j in matched[:5]],
        "input": {"title": req.title, "keywords": req.keywords or []},
        "mode": "keyword",
    }

@app.get("/api/trends")
def get_trends():
    """获取投稿趋势数据（各会议近5年录用率等）"""
    return {"data": TREND_DATA}

# ==================== 学者 ====================
@app.get("/api/scholars")
def get_scholars():
    """获取学者列表及研究方向筛选。"""
    return {"data": SCHOLARS, "directions": SCHOLAR_DIRECTIONS}

@app.get("/api/scholars/graph")
def get_scholars_graph():
    """获取学者研究方向图谱：按共享研究方向连边（nodes/edges/directions）。"""
    from server.serializers import build_scholar_graph
    return {"data": build_scholar_graph(SCHOLARS)}


@app.get("/api/scholars/{scholar_id}")
def get_scholar_detail(scholar_id: str):
    """获取学者详情；无详情数据时回退学者列表中的基础信息。"""
    detail = SCHOLAR_DETAILS.get(scholar_id)
    if detail:
        return {"data": detail}
    for s in SCHOLARS:
        if s["id"] == scholar_id:
            return {"data": s}
    raise HTTPException(status_code=404, detail="学者未找到")

@app.post("/api/scholars/{scholar_id}/follow")
def follow_scholar(scholar_id: str, request: Request):
    """关注学者（需登录）。"""
    user_id = _require_login(request)
    if not any(s["id"] == scholar_id for s in SCHOLARS):
        raise HTTPException(status_code=404, detail="学者不存在")
    _USER_FOLLOWED_SCHOLARS.setdefault(user_id, set()).add(scholar_id)
    return {"data": {"followed": True}}

@app.delete("/api/scholars/{scholar_id}/follow")
def unfollow_scholar(scholar_id: str, request: Request):
    """取消关注学者（需登录）。"""
    _USER_FOLLOWED_SCHOLARS.setdefault(_require_login(request), set()).discard(scholar_id)
    return {"data": {"followed": False}}


# ==================== 机构 ====================
@app.get("/api/institutions")
def get_institutions():
    """获取研究机构列表。"""
    return {"data": INSTITUTIONS}

@app.post("/api/institutions/{inst_id}/bookmark")
def bookmark_institution(inst_id: str, request: Request):
    """收藏机构（需登录）。"""
    user_id = _require_login(request)
    if not any(i["id"] == inst_id for i in INSTITUTIONS):
        raise HTTPException(status_code=404, detail="机构不存在")
    _USER_BOOKMARKED_INSTITUTIONS.setdefault(user_id, set()).add(inst_id)
    return {"data": {"bookmarked": True}}

@app.delete("/api/institutions/{inst_id}/bookmark")
def unbookmark_institution(inst_id: str, request: Request):
    """取消收藏机构（需登录）。"""
    _USER_BOOKMARKED_INSTITUTIONS.setdefault(_require_login(request), set()).discard(inst_id)
    return {"data": {"bookmarked": False}}


# ==================== 项目 ====================
# 内存项目存储：以 mock 项目为种子，支持运行时 CRUD（重启清空）。
_PROJECTS_STORE: list[dict] = [dict(p) for p in PROJECTS]

def _gen_id(prefix: str = "proj_") -> str:
    return prefix + uuid.uuid4().hex[:12]

def _find_project(project_id: str, user_id: str) -> Optional[dict]:
    for p in _PROJECTS_STORE:
        if p["id"] == project_id and p.get("user_id") == user_id:
            return p
    return None


def _require_owned_project(project_id: str, request: Request) -> dict:
    project = _find_project(project_id, _require_login(request))
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    return project

@app.get("/api/projects")
def get_projects(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    status: Optional[str] = None,
):
    """获取科研项目列表（支持分页与状态筛选）。"""
    user_id = _require_login(request)
    result = [p for p in _PROJECTS_STORE if p.get("user_id") == user_id]
    if status:
        result = [p for p in result if p["status"] == status]
    total = len(result)
    start = (page - 1) * page_size
    end = start + page_size
    return {
        "data": [{key: value for key, value in project.items() if key != "user_id"} for project in result[start:end]],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }

@app.post("/api/projects")
def create_project(req: ProjectCreateRequest, request: Request):
    """创建新项目（需登录）。"""
    user_id = _require_login(request)
    if not req.name or not req.name.strip():
        raise HTTPException(status_code=400, detail="项目名称不能为空")
    project = {
        "id": _gen_id(),
        "name": req.name.strip(),
        "tagline": req.tagline or "",
        "status": req.status or "进行中",
        "progress": 0,
        "createdAt": time.strftime("%Y-%m-%d"),
        "owner": "我",
        "user_id": user_id,
        "overview": req.overview or [],
        "techStack": req.techStack or [],
        "milestones": [dict(m) for m in (req.milestones or [])],
        "members": [dict(m) for m in (req.members or [])],
        "links": [dict(l) for l in (req.links or [])],
    }
    _PROJECTS_STORE.append(project)
    return {"data": {"id": project["id"]}}

@app.get("/api/projects/{project_id}")
def get_project_detail(project_id: str, request: Request):
    """获取当前用户拥有的项目详情。"""
    project = _require_owned_project(project_id, request)
    return {"data": {key: value for key, value in project.items() if key != "user_id"}}

@app.put("/api/projects/{project_id}")
def update_project(project_id: str, req: ProjectUpdateRequest, request: Request):
    """更新项目信息（需登录）。"""
    project = _require_owned_project(project_id, request)
    updates = {
        "name": req.name,
        "tagline": req.tagline,
        "status": req.status,
        "progress": req.progress,
        "overview": req.overview,
        "techStack": req.techStack,
        "milestones": [dict(m) for m in req.milestones] if req.milestones is not None else None,
        "members": [dict(m) for m in req.members] if req.members is not None else None,
        "links": [dict(l) for l in req.links] if req.links is not None else None,
    }
    for key, value in updates.items():
        if value is not None:
            project[key] = value
    if req.progress is not None:
        project["progress"] = max(0, min(100, req.progress))
    return {"data": {"updated": True}}

@app.delete("/api/projects/{project_id}")
def delete_project(project_id: str, request: Request):
    """删除项目（需登录）。"""
    user_id = _require_login(request)
    global _PROJECTS_STORE
    before = len(_PROJECTS_STORE)
    _PROJECTS_STORE = [p for p in _PROJECTS_STORE if not (p["id"] == project_id and p.get("user_id") == user_id)]
    if len(_PROJECTS_STORE) == before:
        raise HTTPException(status_code=404, detail="项目不存在")
    return {"data": {"deleted": True}}

# ---- 课题工作台子资源（样例数据，任意项目 id 复用同一套骨架）----

@app.get("/api/projects/{project_id}/outline")
def get_project_outline(project_id: str, request: Request):
    """课题工作台：研究大纲树（Q/H/E/C 层级）。"""
    _require_owned_project(project_id, request)
    return {"data": WORKBENCH_OUTLINE}

@app.get("/api/projects/{project_id}/threads")
def get_project_threads(project_id: str, request: Request):
    """课题工作台：研究线程列表。"""
    _require_owned_project(project_id, request)
    return {"data": WORKBENCH_THREADS}

@app.get("/api/projects/{project_id}/thread-cards")
def get_project_thread_cards(project_id: str, request: Request):
    """课题工作台：全部线程卡片（按线程过滤由组件完成）。"""
    _require_owned_project(project_id, request)
    return {"data": WORKBENCH_CARDS}

@app.get("/api/projects/{project_id}/assets")
def get_project_assets(project_id: str, request: Request):
    """课题工作台：工作台资产（多维表格行）。"""
    _require_owned_project(project_id, request)
    return {"data": WORKBENCH_ASSETS}

@app.get("/api/projects/{project_id}/activity")
def get_project_activity(project_id: str, request: Request):
    """课题工作台：活动日志。"""
    _require_owned_project(project_id, request)
    return {"data": WORKBENCH_ACTIVITY}

@app.get("/api/projects/{project_id}/overview")
def get_project_overview(project_id: str, request: Request):
    """课题工作台：概览聚合（焦点/阻塞项/建议）。"""
    _require_owned_project(project_id, request)
    return {"data": WORKBENCH_OVERVIEW}

@app.get("/api/projects/{project_id}/tasks")
def get_project_tasks(project_id: str, request: Request):
    """课题工作台：Agent 任务状态（底部状态栏）。"""
    _require_owned_project(project_id, request)
    return {"data": WORKBENCH_AGENT_TASKS}

# ==================== 个人文献库 ====================
@app.get("/api/library")
def get_library(
    request: Request,
    folder: Optional[str] = None,
    tag: Optional[str] = None,
    status: Optional[str] = None,
    sort_by: str = Query("collected"),
):
    """
    获取个人文献库列表（支持文件夹、标签、阅读状态筛选）
    :param folder:  文件夹名称筛选
    :param tag:     标签筛选
    :param status:  阅读状态筛选：read / reading / unread
    :param sort_by: 排序方式
    :return:        筛选后的文献列表及阅读统计
    """
    library = _user_items(_USER_LIBRARIES, _require_login(request))
    result = list(library)

    if folder and folder != "all":
        result = [p for p in result if p["folder"] == folder]
    if tag:
        result = [p for p in result if tag in p["tags"]]
    if status:
        result = [p for p in result if p["status"] == status]

    result.sort(key=lambda p: p["collected"], reverse=True)

    return {
        "data": [serialize_library_item(p) for p in result],
        "total": len(library),
        "stats": {
            "read": sum(1 for p in library if p["status"] == "read"),
            "reading": sum(1 for p in library if p["status"] == "reading"),
            "unread": sum(1 for p in library if p["status"] == "unread"),
        }
    }

@app.post("/api/library")
async def add_to_library_endpoint(req: LibraryAddRequest, request: Request):
    """
    添加论文到个人文献库（含输入校验和去重检查）
    :param req: 文献库添加请求体
    :return:    操作结果
    """
    if not req.paper_id or len(req.paper_id) < 2:
        raise HTTPException(status_code=400, detail="无效的论文ID")
    if req.folder and len(req.folder) > 100:
        raise HTTPException(status_code=400, detail="文件夹名称过长")
    logger.info(f"Library add: paper={req.paper_id}, folder={req.folder}")
    return _add_to_library_impl(req, _user_items(_USER_LIBRARIES, _require_login(request)))

def _add_to_library_impl(req: LibraryAddRequest, library: list[dict]):
    """添加论文到文献库的核心实现：查找论文、去重检查、写入文献库"""
    # 查找目标论文
    paper = None
    for p in PAPERS:
        if p["id"] == req.paper_id:
            paper = p
            break
    if not paper:
        raise HTTPException(status_code=404, detail="论文未找到")

    # 检查是否已存在（去重）
    for lp in library:
        if lp["pid"] == req.paper_id:
            return {"message": "论文已在文献库中", "id": lp["id"]}

    new_id = _gen_id("lp_")
    library.append({
        "id": new_id, "pid": paper["id"],
        "title": paper["title"], "authors": paper["authors"],
        "venue": paper["venue"], "ccf": paper["ccf"],
        "status": "unread", "readingProgress": 0,
        "tags": req.tags or [], "folder": req.folder or "默认",
        "collected": "2026-07-23"
    })
    return {"message": "收藏成功", "id": new_id}

@app.delete("/api/library/{paper_id}")
def remove_from_library(paper_id: str, request: Request):
    """
    从文献库中删除指定论文
    :param paper_id: 文献库中的记录 ID
    :return:         操作结果
    :raises HTTPException 404: 文献库中不存在该记录
    """
    library = _user_items(_USER_LIBRARIES, _require_login(request))
    before = len(library)
    library[:] = [p for p in library if p["id"] != paper_id]
    if len(library) == before:
        raise HTTPException(status_code=404, detail="文献库中未找到该论文")
    return {"message": "已删除"}

@app.post("/api/library/batch-delete")
async def batch_delete_library(ids: list[str], request: Request):
    """
    批量删除文献库记录
    :param ids: 要删除的记录 ID 列表
    :return:    删除结果及删除数量
    """
    library = _user_items(_USER_LIBRARIES, _require_login(request))
    before = len(library)
    library[:] = [p for p in library if p["id"] not in ids]
    removed = before - len(library)
    logger.info(f"Batch delete: removed {removed} papers")
    return {"message": f"已删除 {removed} 篇文献", "removed": removed}

@app.delete("/api/library")
async def batch_delete_library_body(req: LibraryBatchDeleteRequest, request: Request):
    """
    批量删除文献库记录（前端 DELETE /api/library + body {ids} 契约）。
    :param req: 含 ids 数组的请求体
    :return:    删除结果及删除数量
    """
    ids = req.ids or []
    if not ids:
        raise HTTPException(status_code=400, detail="请选择要删除的条目")
    library = _user_items(_USER_LIBRARIES, _require_login(request))
    before = len(library)
    library[:] = [p for p in library if p["id"] not in ids]
    removed = before - len(library)
    logger.info(f"Batch delete (DELETE /api/library): removed {removed} papers")
    return {"message": f"已删除 {removed} 篇文献", "removed": removed}

# 文献库文件夹（按用户内存存储，重启清空）
def _sync_library_folders(user_id: str):
    """从 LIBRARY_PAPERS 聚合现有文件夹，保证 count 准确。"""
    from collections import Counter
    counts = Counter(p.get("folder", "默认") for p in _user_items(_USER_LIBRARIES, user_id))
    folders = _user_items(_USER_LIBRARY_FOLDERS, user_id)
    names = {f["name"] for f in folders}
    for name, count in counts.items():
        if name not in names:
            folders.append({"name": name, "count": count, "active": False})
    for f in folders:
        f["count"] = counts.get(f["name"], 0)
    return folders

@app.get("/api/library/folders")
def get_library_folders(request: Request):
    """获取文献库文件夹列表（含各自文献数与激活态）。"""
    folders = _sync_library_folders(_require_login(request))
    return {"data": [{"name": f["name"], "count": f["count"], "active": bool(f["active"])} for f in folders]}

@app.post("/api/library/folders")
def create_library_folder(req: FolderCreateRequest, request: Request):
    """新建文献库文件夹。"""
    name = (req.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="文件夹名称不能为空")
    folders = _user_items(_USER_LIBRARY_FOLDERS, _require_login(request))
    if not any(f["name"] == name for f in folders):
        folders.append({"name": name, "count": 0, "active": False})
    return {"data": {"name": name}}

@app.put("/api/library/{paper_id}/progress")
def update_reading_progress(paper_id: str, request: Request, progress: int = 0):
    """
    更新论文阅读进度，并根据进度自动调整阅读状态
    :param paper_id: 文献库记录 ID
    :param progress: 阅读进度百分比（0-100）
    :return:         更新结果
    :raises HTTPException 404: 记录不存在
    """
    for p in _user_items(_USER_LIBRARIES, _require_login(request)):
        if p["id"] == paper_id:
            p["readingProgress"] = progress
            if progress >= 100:
                p["status"] = "read"
            elif progress > 0:
                p["status"] = "reading"
            return {"message": "已更新", "progress": progress}
    raise HTTPException(status_code=404, detail="未找到")

# ==================== 通知管理 ====================
@app.get("/api/notifications")
def get_notifications(request: Request):
    """获取全部通知列表及未读数量"""
    notifications = _user_items(_USER_NOTIFICATIONS, _require_login(request))
    unread = sum(1 for n in notifications if not n["read"])
    return {"data": notifications, "unread_count": unread}

@app.put("/api/notifications/{notif_id}/read")
def mark_notification_read(notif_id: str, request: Request):
    """
    将指定通知标记为已读
    :param notif_id: 通知唯一标识
    :return:         操作结果
    :raises HTTPException 404: 通知不存在
    """
    for n in _user_items(_USER_NOTIFICATIONS, _require_login(request)):
        if n["id"] == notif_id:
            n["read"] = True
            return {"message": "已标记为已读"}
    raise HTTPException(status_code=404, detail="通知未找到")

# ==================== 收藏管理 ====================
@app.get("/api/favorites")
def get_favorites(request: Request):
    """获取全部收藏列表及数量"""
    favorites = _user_items(_USER_FAVORITES, _require_login(request))
    return {"data": favorites, "count": len(favorites)}

@app.post("/api/favorites")
def add_favorite(req: FavRequest, request: Request):
    """
    添加论文到收藏夹
    :param req: 收藏请求体
    :return:    操作结果
    :raises HTTPException 404: 论文不存在
    """
    favorites = _user_items(_USER_FAVORITES, _require_login(request))
    for p in PAPERS:
        if p["id"] == req.paper_id:
            favorites.append({
                "paper_id": req.paper_id,
                "title": p["title"],
                "folder": req.folder or "默认",
                "tags": req.tags or [],
                "added_at": "2026-07-23"
            })
            return {"message": "收藏成功", "total": len(favorites)}
    raise HTTPException(status_code=404, detail="论文未找到")

@app.delete("/api/favorites/{paper_id}")
def remove_favorite(paper_id: str, request: Request):
    """
    取消指定论文的收藏
    :param paper_id: 论文唯一标识
    :return:         操作结果
    """
    favorites = _user_items(_USER_FAVORITES, _require_login(request))
    favorites[:] = [f for f in favorites if f["paper_id"] != paper_id]
    return {"message": "已取消收藏"}

# ==================== AI 长期记忆 ====================
def _serialize_memory_entry(m: dict) -> dict:
    """输出前端对齐的记忆条目(camelCase)。"""
    out: dict = {
        "id": m["id"],
        "fact": m["fact"],
        "source": m.get("source") or "手动",
        "createdAt": m.get("created_at"),
        "scope": m.get("scope", "global"),
        "enabled": bool(m.get("enabled", True)),
    }
    if out["scope"] == "project":
        out["project"] = m.get("project")
        out["projectId"] = m.get("project_id")
    return out


@app.get("/api/memory")
def get_memory(request: Request, scope: Optional[str] = None):
    """获取当前用户的 AI 记忆(条目列表 + 总开关)。scope 可选过滤 global|project。"""
    user_id = _require_login(request)
    if scope is not None and scope not in ("global", "project"):
        raise HTTPException(status_code=400, detail="scope 仅支持 global / project")
    settings = _USER_MEMORY_SETTINGS.get(user_id) or {"enabled": True}
    entries = [m for m in _user_items(_USER_MEMORY_ENTRIES, user_id)
               if scope is None or m.get("scope") == scope]
    entries.sort(key=lambda m: str(m.get("created_at")), reverse=True)
    return {
        "success": True,
        "data": {
            "enabled": bool(settings.get("enabled", True)),
            "items": [_serialize_memory_entry(m) for m in entries],
        },
    }


@app.put("/api/memory")
def set_memory_enabled(req: MemorySettingsRequest, request: Request):
    """设置 AI 记忆总开关(关闭后 agent 不再引用记忆)。"""
    user_id = _require_login(request)
    _USER_MEMORY_SETTINGS[user_id] = {"enabled": bool(req.enabled)}
    return {"success": True, "data": {"enabled": bool(req.enabled)}}


@app.post("/api/memory/entries")
def create_memory_entry(req: MemoryEntryCreateRequest, request: Request):
    """新增记忆条目(手动 / agent 自动写入)。"""
    user_id = _require_login(request)
    fact = (req.fact or "").strip()
    if not fact:
        raise HTTPException(status_code=400, detail="fact 不能为空")
    scope = "project" if req.scope == "project" else "global"
    if scope == "project" and not req.project_id and not req.project:
        raise HTTPException(status_code=400, detail="项目级记忆需要提供 project_id 或 project")
    entry = {
        "id": _gen_id("mem_"),
        "fact": fact,
        "scope": scope,
        "project_id": req.project_id,
        "project": req.project,
        "source": (req.source or "").strip() or "手动",
        "created_at": datetime.now().isoformat(timespec="seconds"),
        "enabled": True,
    }
    _user_items(_USER_MEMORY_ENTRIES, user_id).append(entry)
    return {"success": True, "data": _serialize_memory_entry(entry)}


@app.put("/api/memory/entries/{entry_id}")
def edit_memory_entry(entry_id: str, req: MemoryEntryEditRequest, request: Request):
    """编辑记忆条目的事实陈述。"""
    user_id = _require_login(request)
    fact = (req.fact or "").strip()
    if not fact:
        raise HTTPException(status_code=400, detail="fact 不能为空")
    for m in _user_items(_USER_MEMORY_ENTRIES, user_id):
        if m["id"] == entry_id:
            m["fact"] = fact
            return {"success": True, "data": _serialize_memory_entry(m)}
    raise HTTPException(status_code=404, detail="记忆条目未找到")


@app.delete("/api/memory/entries/{entry_id}")
def delete_memory_entry(entry_id: str, request: Request):
    """删除记忆条目。"""
    user_id = _require_login(request)
    entries = _user_items(_USER_MEMORY_ENTRIES, user_id)
    before = len(entries)
    entries[:] = [m for m in entries if m["id"] != entry_id]
    if len(entries) == before:
        raise HTTPException(status_code=404, detail="记忆条目未找到")
    return {"success": True, "data": {"id": entry_id}}


@app.post("/api/memory/entries/{entry_id}/toggle")
def toggle_memory_entry(entry_id: str, request: Request):
    """启用 / 停用单条记忆。"""
    user_id = _require_login(request)
    for m in _user_items(_USER_MEMORY_ENTRIES, user_id):
        if m["id"] == entry_id:
            m["enabled"] = not m.get("enabled", True)
            return {"success": True, "data": _serialize_memory_entry(m)}
    raise HTTPException(status_code=404, detail="记忆条目未找到")

# ==================== 开题报告 / 综述生成 ====================
@app.post("/api/proposal/generate")
def proposal_generate(req: ProposalRequest, request: Request):
    """
    生成开题报告 / 文献综述初稿（演示用静态内容 + 动态变量填充，契约对齐前端 app/api/proposal/generate）。
    :param req: {type: 'proposal'|'review', topic?, papers_count?}
    """
    _require_login(request)
    type_ = req.type or "review"
    if type_ not in ("proposal", "review"):
        raise HTTPException(status_code=400, detail="type 必须为 proposal 或 review")
    topic = (req.topic or "").strip() or "扩散模型在机器人策略学习中的研究进展"
    count = req.papers_count or 28

    if type_ == "proposal":
        content = (
            f"# 开题报告:{topic}\n\n"
            "## 一、研究背景与意义\n大语言模型驱动的科研智能体正在改变文献调研、假设生成与实验设计的工作方式。然而现有系统普遍存在检索碎片化、知识组织缺乏结构、长程任务规划能力弱三个问题，难以支撑完整的科研工作流。\n\n"
            "## 二、国内外研究现状\n1. 检索增强生成(RAG)已广泛应用于问答系统；\n2. 多智能体协作框架(如 AutoGen、MetaGPT)在软件工程任务上验证有效；\n3. 私域知识图谱与向量检索的混合索引是当前知识组织的主流方向。\n\n"
            "## 三、研究内容\n1. 科研任务的多智能体角色建模与任务分解机制；\n2. 基于私域知识图谱的文献知识组织与检索增强方法；\n3. 长程科研任务的规划-执行-反思闭环架构；\n4. 原型系统实现与评估。\n\n"
            "## 四、技术路线\n文献调研 → 架构设计 → 关键模块实现 → 系统集成 → 对比实验 → 论文撰写。\n\n"
            "## 五、预期成果\n1. 发表 CCF-A 类会议论文 1~2 篇；\n2. 开源原型系统一套；\n3. 构建面向文献调研任务的评测基准一个。\n\n"
            f"(演示初稿,基于项目检索的 {count} 篇文献生成,请在导师指导下修改完善)"
        )
    else:
        content = (
            f"# 文献综述:{topic}\n\n"
            "## 1. 引言\n相关技术自引入其所在领域后,近年被广泛推广应用。本综述基于 "
            f"{count} 篇代表性文献,梳理该方向的发展脉络、核心方法与开放问题。\n\n"
            "## 2. 发展脉络\n### 2.1 范式确立\n早期奠基性工作提出了核心思想,为后续研究奠定了基础,在多个公开基准上取得了显著提升。\n\n"
            "### 2.2 表征扩展\n后续工作通过引入多模态信息与场景约束,把方法扩展到更复杂的任务设定,显著降低了对数据量的需求。\n\n"
            "### 2.3 规模化与通用化\n近期工作将模型规模推至十亿参数并验证跨领域迁移能力,并探索状态空间模型等加速方向。\n\n"
            "## 3. 关键技术分析\n- **核心模块设计**:在表达能力与计算效率间取得平衡,是核心超参;\n"
            "- **条件注入机制**:FiLM 调制相比特征拼接在长序列训练中更稳定;\n"
            "- **推理效率**:采样步数是工业部署的主要瓶颈,加速方法是当前热点。\n\n"
            "## 4. 开放问题\n1. 实时性:高频场景下的延迟压缩;\n2. 安全性:生成随机性与确定性的矛盾;\n"
            "3. 数据效率:跨领域数据的统一表征与质量筛选。\n\n"
            "## 5. 小结\n该方向已从学术原型进入工业验证阶段,与基础模型的融合是下一步最值得关注的方向。\n\n"
            "(演示初稿,请核对引用后使用)"
        )

    return {
        "data": {
            "type": type_,
            "topic": topic,
            "content": content,
            "papers_count": count,
            "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
    }

# ==================== 平台统计 ====================
@app.get("/api/stats")
def get_stats():
    """获取平台概览统计数据（今日更新、活跃用户、综述撰写、截稿提醒）"""
    return {
        "data": {
            "papers_today": 128,
            "active_users": 3286,
            "reviews_writing": 47,
            "deadline_alerts": 5
        }
    }

@app.get("/api/stats/detailed")
def detailed_stats(request: Request):
    """获取详细统计数据：论文CCF分布、文献库阅读状态分布等"""
    papers_by_ccf = {"A": 0, "B": 0, "C": 0, "预印本": 0}
    for p in PAPERS:
        ccf = p.get("ccf", "未知")
        papers_by_ccf[ccf] = papers_by_ccf.get(ccf, 0) + 1

    user_id = _require_login(request)
    library = _user_items(_USER_LIBRARIES, user_id)
    notifications = _user_items(_USER_NOTIFICATIONS, user_id)
    conversations = _user_items(_USER_CONVERSATIONS, user_id)
    lib_status = {"read": 0, "reading": 0, "unread": 0}
    for p in library:
        lib_status[p["status"]] = lib_status.get(p["status"], 0) + 1

    return {
        "papers": {"total": len(PAPERS), "by_ccf": papers_by_ccf},
        "journals": {"total": len(JOURNALS)},
        "library": {"total": len(library), "by_status": lib_status},
        "conversations": {"total": len(conversations)},
        "notifications": {"total": len(notifications), "unread": sum(1 for n in notifications if not n["read"])}
    }

# ==================== 辅助函数 ====================
def _decompose_intent(query: str):
    """
    意图分解：将用户查询拆分为多个子查询，每个子查询包含意图标签和关键词
    :param query: 用户原始查询文本
    :return:      子查询列表，每个元素含 intent 和 keywords
    """
    keywords_map = {
        "大语言模型": ["llm", "language model", "pre-trained"],
        "推理优化": ["inference", "optimization", "efficient"],
        "transformer": ["transformer", "attention", "self-attention"],
        "注意力": ["attention", "self-attention", "multi-head"],
        "综述": ["survey", "review", "comprehensive"],
        "检索增强": ["rag", "retrieval", "augmented"],
        "图神经网络": ["gnn", "graph", "neural"],
        "对比学习": ["contrastive", "self-supervised", "simclr"],
        "联邦学习": ["federated", "edge", "privacy"],
        "扩散模型": ["diffusion", "generative", "ddpm"],
        "微调": ["fine-tuning", "lora", "adaptation"],
        "推荐": ["recommendation", "recommender"],
    }

    query_lower = query.lower()
    sub_queries = []
    for key, kws in keywords_map.items():
        if key in query_lower:
            sub_queries.append({"intent": key, "keywords": kws})

    if not sub_queries:
        sub_queries.append({"intent": "通用检索", "keywords": [w for w in query.split() if len(w) > 2]})

    return sub_queries[:5]

def _generate_checklist(query: str):
    """
    生成论文验证清单，用于评估检索结果的质量
    :param query: 用户查询文本
    :return:      验证问题列表
    """
    return [
        "是否与查询主题高度相关？",
        "是否发表于CCF推荐的顶级会议/期刊？",
        "方法论是否经过严格实验验证？",
        "是否有足够的引用量支撑影响力？",
        "是否涵盖最新的研究进展（2023年后）？",
    ]

# ==================== 启动入口 ====================
@app.on_event("startup")
def _startup_seed():
    """启动时预置演示用户（demo / demo123456），便于前端登录联调。"""
    try:
        demo_user_id = auth_module.seed_demo_user()
        _seed_demo_private_data(demo_user_id)
        for project in _PROJECTS_STORE:
            project.setdefault("user_id", demo_user_id)
        logger.info("演示用户已就绪: demo / demo123456")
    except Exception as exc:  # pragma: no cover
        logger.warning(f"演示用户播种失败: {exc}")

if __name__ == "__main__":
    import uvicorn
    logger.info("=" * 50)
    logger.info("  研枢 YanShu API Server Starting...")
    logger.info(f"  Papers loaded: {len(PAPERS)}")
    logger.info(f"  Journals loaded: {len(JOURNALS)}")
    logger.info(f"  Conversations loaded: {len(CONVERSATIONS)}")
    logger.info("=" * 50)
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
