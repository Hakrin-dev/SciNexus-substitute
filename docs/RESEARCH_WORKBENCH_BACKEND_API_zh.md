# 研究台后端 API

本模块负责保存研究运行、进度、指令、实验和产物。Web 端把任务写入持久化队列，`backend.worker.main` 独立进程领取任务并运行仓库内的 SimpleAutoResearch。所有用户接口均需携带现有登录接口签发的 Bearer Token，并校验项目归属。

## 数据关系

```text
project
  └─ research_run
       ├─ event
       ├─ instruction
       ├─ experiment (可多轮)
       └─ artifact
```

引擎阶段固定为：`plan → search → read → synthesize → design → code → run → report`。

工作台展示仍聚合为：`plan → search → read → synthesize → experiment → report`，其中 `design/code/run` 映射为 `experiment`。

运行状态固定为：`queued | running | paused | completed | failed | cancelled`。

## 接口

| 方法 | 地址 | 用途 |
| --- | --- | --- |
| `GET` | `/api/projects/:projectId/research-runs` | 获取项目的研究运行列表 |
| `POST` | `/api/projects/:projectId/research-runs` | 创建研究运行，参数：`objective` |
| `GET` | `/api/projects/:projectId/research-runs/:runId` | 获取一次运行的状态 |
| `POST` | `/api/projects/:projectId/research-runs/:runId/actions` | 暂停、恢复或取消，参数：`action` |
| `POST` | `/api/projects/:projectId/research-runs/:runId/checkpoint` | 回写阶段、状态和进度 |
| `GET` | `/api/projects/:projectId/research-runs/:runId/events` | 读取事件；可用 `after` 增量查询 |
| `GET/POST` | `/api/projects/:projectId/research-runs/:runId/instructions` | 读取或追加用户指令 |
| `GET/POST` | `/api/projects/:projectId/research-runs/:runId/experiments` | 读取或登记实验轮次 |
| `PATCH` | `/api/projects/:projectId/research-runs/:runId/experiments/:experimentId` | 回写实验状态、指标、stdout 和 stderr |
| `GET/POST` | `/api/projects/:projectId/research-runs/:runId/artifacts` | 读取或登记报告、代码、数据、笔记等产物 |

## 示例

创建研究运行：

```json
{
  "objective": "研究图神经网络在小样本论文分类中的效果"
}
```

回写阶段进度：

```json
{
  "phase": "search",
  "status": "running",
  "progress": 25,
  "message": "已完成第一轮文献检索"
}
```

登记实验：

```json
{
  "title": "词特征基线实验",
  "round": 1,
  "status": "passed",
  "hypothesis": "加入词特征可以提高分类准确率",
  "metrics": { "accuracy": 0.642857, "macro_f1": 0.641026 },
  "stdout": "accuracy: 0.642857",
  "stderr": "",
  "codeRef": "workspace/experiment_01"
}
```

## 执行与恢复

- 队列适配器位于 `lib/server/research-runs.ts`，worker 位于 `backend/worker`。
- 暂停和取消采用协作式控制，在阶段安全检查点生效；排队中或已暂停任务可立即转换状态。
- `state.json` 是引擎恢复依据，数据库同时保存八阶段原始状态和六阶段展示状态。
- worker 将指标、stdout、stderr、报告和阶段文件幂等登记到实验、产物、资产、卡片及活动日志。
- 事件具有单次运行内递增的 `sequence`，前端当前轮询读取，后续可无损升级为 SSE。
