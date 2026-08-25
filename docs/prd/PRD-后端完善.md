# PRD · 后端完善

> 定义 FastAPI 后端(`backend/`)从"演示原型"升级为可上线服务时的目标状态与验收要求。
> 已确认缺陷的技术细节见配套开发文档:[../dev/后端已知问题与技术债.md](../dev/后端已知问题与技术债.md)。
> 前置说明:当前线上仅前端容器化(自带 Route Handlers + SQLite 承担演示数据),本 PRD 面向后端独立部署/接管 AI 链路时生效。

---

## 1. 目标与非目标

**目标**

1. 深度对话全链路真流式,弱网/慢模型下用户始终有反馈、可中断;
2. 单实例承载 ≥50 并发会话时,健康检查与非 LLM 接口不受慢请求拖累;
3. 用户数据(会话/文献库/收藏)重启不丢,水平扩容可行;
4. 对外安全基线:同源白名单 CORS、全端点限流、无内部信息泄露;
5. LLM 成本可控可观测:按意图的调用预算、缓存命中可统计。

**非目标(本期不做)**

- 多租户计费与配额商业化;分布式 tracing;K8s 编排。

---

## 2. 功能需求

### 2.1 真流式对话(P0)

- `/api/chat/stream` 基于 LangGraph `astream_events` 透传 token 流,**首字节延迟 = supervisor 决策时间**(而非全文生成完毕);
- SSE 事件序列保持现有契约:`event: meta`(含 conversation_id/workflow/references/generated_files)→ `data:{choices:[{delta:{content}}]}` → `event: done`,前端 `lib/api/client.ts streamChat` 无需改动即可消费;
- 支持客户端断开:连接关闭后 agent 任务在 ≤5s 内取消,不再继续消耗 LLM tokens;
- **验收**:深度模式首字 <5s(网络正常);curl 中途 Ctrl-C 后,服务端日志 5s 内出现任务取消记录。

### 2.2 运行时稳定性(P0)

| 要求 | 验收标准 |
|------|----------|
| 事件循环隔离 | 任一 LLM 调用挂起 60s 时,`/api/health` P99 <100ms |
| recursion_limit | 按 plan 长度动态设置;构造连续失败场景不抛 GraphRecursionError,而是走 finalize 兜底返回已有产出 |
| LLM 超时 | OpenAI 客户端 timeout 可配(默认 ≤120s),max_retries=1;超时有结构化日志 |
| 兜底路径 | AGENT_ENABLED=False 及 agent 异常两种场景下,SSE 流完整走完 meta→delta→done(修 NameError) |

### 2.3 数据安全与持久化(P0)

- 语料库(papers/venues)只读消费:运行期任何代码路径不得对语料表执行 DELETE/INSERT;写入只属于 ingest 脚本;
- 回退链降级必须显式:每次降级输出 WARNING 日志(源名+原因),响应头带 `X-Data-Source` 便于排查;
- 会话(conversations)、文献库(library)、收藏(favorites)、通知(notifications)落 sqlite,重启保留;id 一律 uuid/前缀随机串,禁止 len 自增;
- embeddings 缓存原子写(tmp + os.replace)。

### 2.4 安全基线(P0)

- CORS:`allow_origins` 白名单(环境变量注入),生产禁用 `*`+credentials 组合;
- 全部端点限流覆盖,含两个 stream 端点(LLM 类单独更严阈值);限流键取真实客户端 IP(X-Forwarded-For / proxy-headers);
- 500 响应不含内部异常细节,只回 request_id;
- paper_id 等入参拼文件路径前做 `[A-Za-z0-9_.\-]+` 白名单校验。

### 2.5 成本治理(P1)

- writer 仅综述意图触发三阶段管线;paper_draft 走独立轻量生成;
- 按意图声明 LLM 调用预算并落日志:paper_search ≤4、literature_review ≤25、autonomous_research 设硬上限,超限走 finalize;
- complete/chat_text 加 (prompt_hash, model) 级缓存,缓存命中计数暴露到 `/api/health/detailed`;
- synthesis QA payload:精读篇数 ≤3,单篇分析截断,超限降级题录列表。

### 2.6 可观测性(P1)

- supervisor/llm/agents 接入 logging:规划决策 JSON、失败四分类、重试/跳过、每次 LLM 调用 latency 与 token 数;
- 失败分类改为结构化 `AgentError{category, retriable, detail}`,废除英文子串嗅探;
- 综述对比表等确定性产物由代码生成、LLM 只填自然语言段("确定性骨架 + LLM 填空"),mock 与真实模式跑同一管线断言结构不变量(属性测试)。

---

## 3. 接口契约

- 与前端契约以 `lib/api/client.ts` + 本仓库 `app/api/**`(Route Handlers)为准;字段命名沿用前端 camelCase,视觉字段由前端派生;
- FastAPI 若长期作为 AI 链路专用网关,仅需保证 `/api/chat/stream`、`/api/search`、`/api/translate/stream` 三个端点契约一致;其余列表类端点可继续由 Route Handlers 承担;
- 已知差异清单(FastAPI serializers 不产视觉字段、缺 venues/graph/auth 等路径)详见 dev 文档,接入前端前必须补齐或在前端标注能力探测。

## 4. 里程碑建议

| 阶段 | 内容 | 对应 PRD 条目 |
|------|------|---------------|
| M1 止血 | NameError、事件循环隔离、CORS、限流、recursion_limit/timeout | 2.1 部分、2.2、2.4 |
| M2 数据 | 语料只读化、显式降级、会话/文献库落库、原子写 | 2.3 |
| M3 流式与成本 | astream_events 真流式、writer 分流、预算与缓存、结构化日志 | 2.1、2.5、2.6 |
