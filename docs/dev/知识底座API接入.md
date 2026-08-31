# 知识底座 API 接入

项目现在通过服务端适配层接入远程知识底座，浏览器不会直接请求远端地址。

## 配置

```env
RETRIEVAL_PROVIDER=remote
RETRIEVAL_API_URL=https://knowledge.example.com
# RETRIEVAL_API_TOKEN=仅服务端保存的访问令牌
RETRIEVAL_TIMEOUT_SECONDS=30
RETRIEVAL_RETRY_COUNT=2
RETRIEVAL_DEFAULT_TOP_K=10
RETRIEVAL_FALLBACK_LOCAL=true
RETRIEVAL_CIRCUIT_FAILURE_THRESHOLD=3
RETRIEVAL_CIRCUIT_RESET_SECONDS=30
```

- `remote`：检索、论文详情和图谱优先使用远程知识底座。
- `local`：保持原有 SQLite/mock 行为。
- `hybrid`：远程与本地结果使用加权 RRF 融合并按论文 ID 去重。
- `RETRIEVAL_FALLBACK_LOCAL=true`：远程超时、网络失败或服务异常时回退本地数据；健康接口会报告回退率。
- 生产环境必须使用 HTTPS。只有受控内网场景可显式设置 `RETRIEVAL_ALLOW_INSECURE_HTTP=true`。

## 项目接口

- `POST /api/search`：支持 `query`、`top_k`、`year_from`、`year_to`、`conference`、`author`、`keyword`、`subject`。
- `GET /api/papers/{paper_id}`：远程论文详情，失败时回退本地。
- `GET /api/graph/public?paper_id={paper_id}`：远程知识图谱，保留 `from -> to` 引用方向。
- `GET /api/knowledge/health`：主服务、检索服务和 ready 状态汇总。

检索响应的 `meta.source` 为 `remote_knowledge_base` 或 `local`；`fallbackUsed` 表示是否发生降级。远程 `score` 是排序分值，不应解释为百分比。

## 智能体

Scout 在 `remote` 模式下使用远程增强检索，在 `hybrid` 模式下合并远程、VectorRAG 和 GraphRAG 的候选并按论文 ID 去重。Librarian 使用远程图谱扩展真实论文关系，Synthesis 在本地缺少论文元数据时从远程详情补充上下文。所有远程论文都标记 `db_source=remote_knowledge_base`，供后续 Synthesis/Critic 追踪证据来源。

## 重试规则

默认超时 30 秒。HTTP 500/503、网络错误和超时最多重试 2 次；400/404 不重试。不得把认证密钥或私有服务凭据提交到仓库。

## 生产运行与评测

- 连续失败达到 `RETRIEVAL_CIRCUIT_FAILURE_THRESHOLD` 后，客户端会熔断至 `RETRIEVAL_CIRCUIT_RESET_SECONDS`，防止故障上游拖垮页面；`/api/knowledge/health` 会返回请求数、失败数、回退率和 P95。
- 使用 `node scripts/evaluate-knowledge-retrieval.mjs evaluation/knowledge-retrieval.jsonl` 运行评测。标注集必须由人工确认 `query -> relevantPaperIds`，示例文件仅说明格式，不能作为线上指标。
