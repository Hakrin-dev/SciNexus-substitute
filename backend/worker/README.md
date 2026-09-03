# 自动研究 worker

该进程消费 Next.js 写入 `research_runs` 的持久化队列，并逐阶段运行仓库内
`backend/auto_research` 的 SimpleAutoResearch 引擎。运行状态、事件、实验和产物会投影回
课题工作台的 SQLite 数据库。

## 本地启动

先启动 Web 应用一次以初始化 `data/yanshu.db`，再在另一个终端安装并启动 worker：

```bash
python -m pip install -e backend/auto_research
python -m backend.worker.main
```

单次领取任务可使用 `--once`。关键环境变量：

- `SCINEXUS_DB_PATH`：共享 SQLite 路径，默认 `data/yanshu.db`。
- `AUTO_RESEARCH_RUNS_ROOT`：运行产物根目录，默认 `data/research-runs`。
- `AUTO_RESEARCH_LLM_ENABLED`：是否启用 LLM，默认 `true`。
- `AUTO_RESEARCH_OFFLINE`：是否只使用离线检索，默认 `false`。
- `OPENAI_API_KEY`、`OPENAI_BASE_URL`、`OPENAI_MODEL`：由 SimpleAutoResearch 使用。

暂停和取消采用协作式控制：正在执行的最小阶段结束后，worker 在安全检查点应用请求。
