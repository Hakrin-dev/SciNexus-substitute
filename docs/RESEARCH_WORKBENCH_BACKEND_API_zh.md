# 研究台后端 API（执行器接入前版本）

本模块负责保存研究运行、进度、指令、实验和产物。目前执行器为 `placeholder`，不会引入或运行 SimpleAutoResearch。所有接口均需携带现有登录接口签发的 Bearer Token，并校验项目归属。

## 数据关系

```text
project
  └─ research_run
       ├─ event
       ├─ instruction
       ├─ experiment (可多轮)
       └─ artifact
```

研究阶段固定为：`plan → search → read → synthesize → experiment → report`。

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

## 后续接入点

执行器抽象位于 `lib/server/research-runs.ts`。真实接入时需要：

1. 实现 `ResearchExecutor`，负责启动、暂停、恢复和取消外部任务。
2. 为执行器回调增加独立的服务身份认证，避免使用用户 Token。
3. 将外部阶段映射为平台的六个固定阶段。
4. 将指标、stdout、stderr 和文件登记到实验及产物接口。
5. 使用事件表实现 SSE 或 WebSocket 实时推送。

平台数据库和前端不应直接依赖 SimpleAutoResearch 的内部目录或 Python 类型。
