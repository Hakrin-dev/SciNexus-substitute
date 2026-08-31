# 研枢后端（FastAPI）

> 远程知识底座的配置、检索/详情/图谱接口与降级策略见
> [`docs/dev/知识底座API接入.md`](../docs/dev/知识底座API接入.md)。默认 `RETRIEVAL_PROVIDER=remote`，
> 可用 `local` 保持原有本地数据源行为，或用 `hybrid` 启用加权 RRF 融合。

从 `SciNexus-proto` 复制而来的后端：`server/`（API + 序列化 + mock 数据）+ `agent/`（多智能体框架 + 本地语料）。

## 启动

```bash
cd backend
pip install -r requirements.txt      # 首次
python -m uvicorn server.main:app --host 0.0.0.0 --port 8000
```

- 接口文档：http://localhost:8000/docs
- 健康检查：http://localhost:8000/api/health

## 数据层（本地 SQLite + mock 保底）

- `TOOL_DATA_SOURCE=sqlite` → 读 `server/data/research.sqlite`（真实入库语料，约 4MB）
- 加载失败自动回退：`json`（server/data/papers.json）→ `server_mock`（mock_data.py）→ 内置兜底数据
- PDF 全文在 `server/data/pdfs/`（约 140MB，本地语料）；缺失时 `fulltext` 回退摘要+结构化分析
- 配置见 `agent/.env`（真实密钥，勿提交）与 `.env.example`（模板）

## 前端对接

前端 `NEXT_PUBLIC_API_URL` 指向本服务（默认 http://localhost:8000），
接口契约按「前端优先」对齐：数据字段用前端命名（tags/citations 数字/abbr 等），
视觉字段（颜色/徽章/倒计时）由前端派生，见前端 `lib/api/adapters.ts`。
