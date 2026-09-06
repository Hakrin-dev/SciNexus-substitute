# 知识底座 API 接入

项目现在通过服务端适配层接入远程知识底座，浏览器不会直接请求远端地址。

## 配置

```env
RETRIEVAL_PROVIDER=remote
RETRIEVAL_API_URL=https://knowledge.example.com
# RETRIEVAL_API_TOKEN=仅服务端保存的访问令牌
RETRIEVAL_TIMEOUT_SECONDS=30
RETRIEVAL_RETRY_COUNT=1
RETRIEVAL_DEFAULT_TOP_K=10
RETRIEVAL_FALLBACK_LOCAL=false
RETRIEVAL_CIRCUIT_FAILURE_THRESHOLD=3
RETRIEVAL_CIRCUIT_RESET_SECONDS=30
```

- `remote`：检索、论文详情和图谱优先使用远程知识底座。
- `local`：保持原有 SQLite/mock 行为。
- `hybrid`：远程与本地结果使用加权 RRF 融合并按论文 ID 去重。
- `RETRIEVAL_API_URL` 在 remote/hybrid 模式下必须显式配置；未配置时返回安全的“知识底座尚未配置”错误，绝不使用源码中的默认 IP。
- `RETRIEVAL_FALLBACK_LOCAL=true`：仅在明确接受“本地检索/相关图不等价于远程知识库”时启用。健康接口会报告回退率。
- 生产环境必须使用 HTTPS。只有受控内网场景可显式设置 `RETRIEVAL_ALLOW_INSECURE_HTTP=true`。

## 项目接口

- `POST /api/v1/knowledge/search`：正式知识检索接口，使用 `query`、`topK`、`yearFrom`、`yearTo`、`venue`、`author`、`keyword`、`subject`。
- `GET /api/v1/knowledge/paper?paperId={paperId}`：正式论文详情接口。
- `GET /api/v1/knowledge/graph?paperId={paperId}&depth=1|2`：正式引用图谱接口，保留 `from -> to` 引用方向。
- `POST /api/search`、`GET /api/papers/{paper_id}`、`GET /api/graph/public`：保留给现有页面/客户端的兼容入口；它们可以按旧策略使用本地降级，不能作为远程事实的唯一来源。
- `GET /api/knowledge/health`：主服务、检索服务和 ready 状态汇总。

正式 Knowledge API 的成功响应为 `{ success: true, data }`；失败响应为 `{ success: false, error: { code, message, retryable, requestId } }`。`code` 只会是 `NOT_FOUND`、`INVALID_ARGUMENT`、`RATE_LIMITED`、`UPSTREAM_UNAVAILABLE`、`TIMEOUT`、`CONTRACT_VIOLATION` 或 `UNKNOWN`。同一条链路必须满足 `SearchResult.paperId === Paper.paperId === Graph.rootId`。

远程 `score` 是排序分值，不应解释为百分比；`citationCount` 和 `referenceCount` 缺失时为 `null`，不能解释成 0。兼容接口中的 `meta.source` 为 `remote_knowledge_base` 或 `local`；`fallbackUsed` 表示是否发生降级。

## 智能体

Scout 在 `remote` 模式下使用远程增强检索，在 `hybrid` 模式下合并远程、VectorRAG 和 GraphRAG 的候选并按论文 ID 去重。Librarian 使用远程图谱扩展真实论文关系，Synthesis 在本地缺少论文元数据时从远程详情补充上下文。所有远程论文都标记 `db_source=remote_knowledge_base`，供后续 Synthesis/Critic 追踪证据来源。

## 重试规则

默认超时 30 秒。HTTP 500/503、网络错误和超时最多重试 1 次；400/404 不重试。不得把认证密钥或私有服务凭据提交到仓库。

## 生产运行与评测

- 连续失败达到 `RETRIEVAL_CIRCUIT_FAILURE_THRESHOLD` 后，客户端会熔断至 `RETRIEVAL_CIRCUIT_RESET_SECONDS`，防止故障上游拖垮页面；`/api/knowledge/health` 会返回请求数、失败数、回退率和 P95。
- 使用 `node scripts/evaluate-knowledge-retrieval.mjs evaluation/knowledge-retrieval.jsonl` 运行评测。标注集必须由人工确认 `query -> relevantPaperIds`，示例文件仅说明格式，不能作为线上指标。
