# 多租户自动研究架构

## 边界

- `scinexus` 是公开只读示例项目；匿名用户可浏览，不能改写或启动运行。
- 新项目必须登录创建。项目权限以 `project_members` 为准，角色为 owner/admin/editor/viewer；组织权限通过 `organization_members` 继承。
- 所有工作台、运行、实验和资产查询都先校验项目权限；无权限统一返回 404，避免泄露项目是否存在。
- 登录态只存放在 HttpOnly、SameSite Cookie 中。密码限定 6–12 位，使用 210,000 轮 PBKDF2；旧哈希在成功登录后升级。
- 长期记忆默认关闭，只有用户显式开启后才检索或写入；明显的凭据和个人标识会被拒绝。

## 自动研究边界

`backend/auto_research` 只定义稳定适配协议和明确标记的 mock adapter，没有复制 SimpleAutoResearch 源码。`backend/worker` 负责队列声明、心跳、暂停/恢复/取消、追加指令、阶段事件以及产物落库。以后接入真实引擎时，实现 `ResearchAdapter`，并由 Worker 根据运行配置选择 adapter；API、数据库和前端不需要改协议。

阶段固定为：`plan → search → read → synthesize → design → code → run → report`。每阶段写入线程卡片和资产，实验阶段写入结构化实验记录，报告阶段生成独立报告资产。模拟结果始终携带 `executionMode: mock`，不得作为真实研究结论。

## 部署

Docker 镜像运行层包含 Python 3、`backend/auto_research` 和 `backend/worker`。Compose 的 web 与 worker 共享 `scinexus-data` 卷；生产环境必须配置 `AUTH_SECRET`。SQLite 适合单机单卷部署，若扩展为多主机实例，应将数据库和队列迁移到 PostgreSQL + Redis/专用队列，并将速率限制迁移到共享存储。

## 验证

```powershell
pnpm lint
pnpm build
python -m py_compile backend/auto_research/protocol.py backend/auto_research/mock_adapter.py backend/worker/main.py
docker compose config
```

端到端验收应注册两个用户：A 创建私有项目，B 读取详情须得到 404；A 启动模拟运行后，应最终得到 `completed/100%`、8 个阶段资产、1 个实验和 1 个报告。
