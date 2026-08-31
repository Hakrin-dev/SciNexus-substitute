# 后端服务目录

远程知识底座已接入 `/api/search`、`/api/papers/{paper_id}`、
`/api/graph/public?paper_id=...` 和 `/api/knowledge/health`。服务端统一处理 30 秒超时、
500/503 有限重试与本地降级；具体环境变量和响应元信息见
[`docs/dev/知识底座API接入.md`](../../docs/dev/知识底座API接入.md)。

FastAPI 后端服务（`main.py`），提供论文检索、AI 对话、投稿匹配、文献库等 REST API。

## 启动

```powershell
# 安装依赖
pip install -r requirements.txt
# 额外：agent 网关依赖（见 agent/requirements.txt，用于接入多智能体）

# 启动（在项目根目录）
python -m uvicorn server.main:app --host 0.0.0.0 --port 8000
```

## 与多智能体框架对接

server 通过 `server/agent_gateway.py` 把 `/api/search`、`/api/chat`、`/api/papers` 转发到
`agent/research_assistant` 的多智能体工作流。

| 环境变量 | 默认 | 说明 |
| --- | --- | --- |
| `AGENT_ENABLED` | `true` | 是否启用 agent 网关；设为 `false` 回退到内置 mock 数据 |
| `TOOL_DATA_SOURCE` | `server_mock` | agent 数据源：`server_mock` / `json` / `sqlite`（真实入库，先跑 `agent/scripts/ingest_openalex.py`） |
| `LLM_PROVIDER` | `mock` | agent 底层 LLM：`mock` / `ollama` / `openai` |

示例（用真实数据跑）：

```powershell
$env:AGENT_ENABLED = "true"
$env:TOOL_DATA_SOURCE = "sqlite"
$env:LLM_PROVIDER = "mock"
python -m uvicorn server.main:app --port 8000
```

## 真实数据（OpenAlex）接线

默认数据源是 `server_mock`（`server/data/mock_data.py` 的 11 篇演示论文）。要让前端显示 OpenAlex 真实论文：

1. **灌入 OpenAlex 元数据**（摘要/关键词/引用关系，不下载 PDF）：

   ```powershell
   python agent/scripts/ingest_openalex.py --query "large language model" --limit 100
   ```

   写入 `server/data/research.sqlite`（100 篇；OpenAlex 不提供"创新点/实验数据"，这些字段由 PDF 结构化分析生成）。

2. **配置数据源**：编辑 `agent/.env`（模板见 `agent/.env.example`）设置
   `TOOL_DATA_SOURCE=sqlite`，或启动前设置环境变量 `TOOL_DATA_SOURCE=sqlite`。

3. **（可选）批量 PDF 结构化分析**：让每篇论文获得创新点/实验/方法的结构化摘录，
   阅读页"创新/实验"标签会展示真实内容：

   ```powershell
   python agent/scripts/ingest_pdfs.py
   ```

   处理 `server/data/pdfs/` 下与 sqlite 论文 ID 匹配的 PDF，写入 `paper_analysis` 表（幂等，可重复执行）。

4. **验证**：`curl http://localhost:8000/api/papers?page_size=3` 应返回 `W*` 开头的真实论文
   （含摘要）；`curl http://localhost:8000/api/papers/W4384071683` 应含 `structured` 字段。

> 注意：`TOOL_DATA_SOURCE` 默认保持 `server_mock`，避免空库时 mock 回退把演示数据写进真实库。
