# Vercel 云端知识底座环境变量配置

本文说明如何为 `SciNexus-substitute` 的 Vercel 生产环境配置知识底座服务。

## 一、当前问题

访问云端站点：

```text
https://scinexus-five.vercel.app/
```

如果首页显示：

```text
知识底座尚未配置
```

说明 Vercel 运行环境中没有配置 `RETRIEVAL_API_URL`。此时应用不会请求知识底座，也不会使用本地演示论文替代。

可通过下面的健康检查接口确认：

```text
https://scinexus-five.vercel.app/api/knowledge/health
```

未配置时通常会返回：

```json
{
  "status": "unavailable",
  "provider": "remote",
  "error": "知识底座尚未配置"
}
```

## 二、在 Vercel 中添加环境变量

进入 Vercel 项目：

1. 打开 Vercel 控制台。
2. 选择项目 `scinexus-five`。
3. 进入 `Settings` → `Environment Variables`。
4. 为 `Production` 环境添加以下变量。

### 必填变量

```env
RETRIEVAL_PROVIDER=remote
RETRIEVAL_API_URL=https://你的知识底座域名
RETRIEVAL_API_TOKEN=你的知识底座访问令牌
```

`RETRIEVAL_API_URL` 应填写知识底座服务的实际 HTTP(S) 基础地址，不要把具体接口路径重复拼接进去。例如：

```env
RETRIEVAL_API_URL=https://knowledge.example.com
```

`RETRIEVAL_API_TOKEN` 只在服务端使用，不要以 `NEXT_PUBLIC_` 开头，也不要写入前端代码、Markdown、截图或 Git 仓库。

### 推荐变量

```env
RETRIEVAL_FALLBACK_LOCAL=false
RETRIEVAL_TIMEOUT_SECONDS=30
RETRIEVAL_RETRY_COUNT=1
RETRIEVAL_DEFAULT_TOP_K=10
RETRIEVAL_CIRCUIT_FAILURE_THRESHOLD=3
RETRIEVAL_CIRCUIT_RESET_SECONDS=30
```

`RETRIEVAL_FALLBACK_LOCAL=false` 表示远程知识底座不可用时显示真实不可用状态，不把本地演示数据伪装成远程结果。

## 三、HTTP 地址的生产环境限制

当前本地曾使用：

```text
http://47.110.47.12
```

生产环境默认要求 `RETRIEVAL_API_URL` 使用 HTTPS。推荐先为知识底座配置 HTTPS 域名，再填写：

```env
RETRIEVAL_API_URL=https://你的知识底座域名
```

如果暂时只能使用受控内网 HTTP 地址，才临时添加：

```env
RETRIEVAL_ALLOW_INSECURE_HTTP=true
```

公网生产环境不建议开启该变量，因为 HTTP 不会加密传输检索请求及访问令牌。Vercel 部署使用生产环境配置时，如果填写 HTTP 地址而未设置该变量，应用会返回：

```text
生产环境知识底座必须使用 HTTPS
```

## 四、重新部署

环境变量保存后，必须创建新的 Vercel 部署，旧部署不会自动读取新变量。

可以选择以下方式之一：

1. 在 `Deployments` 中选择最新部署，点击 `Redeploy`。
2. 向 GitHub `main` 分支推送新的提交，触发自动部署。

推荐先在 Vercel 控制台确认变量的环境范围是 `Production`，然后执行 `Redeploy`。

## 五、部署后验证

### 1. 验证健康状态

访问：

```text
https://scinexus-five.vercel.app/api/knowledge/health
```

配置正确且上游可访问时，应看到状态类似：

```json
{
  "status": "ready",
  "provider": "remote",
  "source": "remote_knowledge_base"
}
```

如果 Token、地址或上游服务存在问题，接口会返回 `degraded` 或 `unavailable`，同时给出服务检查状态。

### 2. 验证首页随机论文

访问首页：

```text
https://scinexus-five.vercel.app/
```

应能看到：

```text
知识底座已连接 · remote
来自知识底座的随机论文 · 10 篇
```

论文卡片应标记为“远程知识底座”。

### 3. 验证发现接口

访问：

```text
https://scinexus-five.vercel.app/api/v1/knowledge/discover
```

成功时返回 `success: true`，并在 `data.results` 中包含论文列表，在 `data.meta` 中标记：

```json
{
  "source": "remote_knowledge_base",
  "random": true,
  "count": 10
}
```

## 六、常见问题

### 配置后仍显示“尚未配置”

检查：

- 变量名称是否准确为 `RETRIEVAL_API_URL`。
- 变量是否添加到了 `Production` 环境。
- 是否执行了新的部署，而不是继续访问旧部署。
- Vercel 部署日志中是否包含新的提交。

### 显示“知识底座请求失败”

检查：

- Vercel 服务端是否能访问知识底座域名。
- `RETRIEVAL_API_URL` 是否包含错误的路径或尾部接口路径。
- Token 是否有效。
- 知识底座服务是否限制了来源 IP、请求头或访问频率。

### 首页正常但论文 PDF 无法阅读

知识检索和 PDF 获取是两条链路。需要确认远程论文返回了 `pdf_url` 或 `pdfUrl`，并且该地址：

- 可从 Vercel 服务端访问。
- 返回真实 PDF，而不是 HTML、登录页或 JSON 错误。
- 没有解析到被禁止访问的私网地址。

## 七、安全要求

- 不要把 `RETRIEVAL_API_TOKEN` 配置成 `NEXT_PUBLIC_` 变量。
- 不要把真实 Token 写入 `.env.example`、README、截图或提交记录。
- 公网部署优先使用 HTTPS 知识底座地址。
- 不要在公网环境开启 `KNOWLEDGE_PDF_ALLOW_PRIVATE_NETWORK=true`。
- 变量修改后应重新部署，并通过 `/api/knowledge/health` 验证实际运行环境。

## 八、API 手册与本项目的对应关系

知识底座原始服务地址目前为：

```text
http://47.110.47.12
```

Vercel 中的 `RETRIEVAL_API_URL` 只填写基础地址，不要填写具体接口。例如：

```env
RETRIEVAL_API_URL=http://47.110.47.12
```

应用服务端会根据功能自动拼接以下接口：

| 本项目功能 | 知识底座接口 | 请求方式 |
| --- | --- | --- |
| 关键词/条件论文检索 | `/api/retrieval/search` | `POST` |
| 首页随机论文 | `/api/papers` | `GET` |
| 论文详情 | `/api/kg/paper?paperId=...` | `GET` |
| 引用知识图谱 | `/api/kg/graph?paperId=...&depth=1` | `GET` |
| 标题快速查询 | `/api/kg/search?q=...&limit=20` | `GET` |
| 检索服务健康状态 | `/api/retrieval/health` | `GET` |
| 检索服务就绪状态 | `/api/retrieval/ready` | `GET` |

浏览器不会直接请求上游地址。论文检索、详情、图谱和 PDF 都由 Vercel 的服务端 Route Handler 代理，Token 也只在服务端请求头中使用。

## 九、检索接口的请求契约

本项目调用增强检索接口：

```http
POST http://47.110.47.12/api/retrieval/search
Content-Type: application/json
```

请求体结构如下：

```json
{
  "query": "2022年以后关于图神经网络的论文",
  "top_k": 10,
  "year_gte": 2022,
  "year_lte": 2026,
  "conference": ["AAAI"],
  "author": [],
  "keyword": [],
  "subject": []
}
```

参数说明：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `query` | string | 必填，论文标题、摘要或自然语言查询 |
| `top_k` | integer | 返回数量；本项目限制在 1 至 50，建议不超过 20 |
| `year_gte` | integer | 最早发表年份 |
| `year_lte` | integer | 最晚发表年份 |
| `conference` | string[] | 会议名称列表 |
| `author` | string[] | 作者列表 |
| `keyword` | string[] | 关键词列表 |
| `subject` | string[] | 主题列表 |

返回结果中的 `rank` 用于排序，`score` 是相关性排序分值，不是百分比。`authors`、`keywords` 或 `subjects` 为空时，前端应显示为空，不应自行制造作者或关键词。

知识底座也支持 GET 快速查询：

```text
GET http://47.110.47.12/api/retrieval/search?q=graph%20neural%20network&top_k=10
```

但本项目的服务端适配器使用 POST，以便传递年份、会议、作者、关键词和主题筛选条件。

## 十、首页随机论文的接口要求

首页随机论文使用知识底座的论文列表接口：

```text
GET http://47.110.47.12/api/papers?limit=1&offset=0
```

应用先读取 `total`，再计算随机 `offset`，随后请求一段论文窗口并去重，最终返回 10 篇论文。因此该接口必须支持：

```text
limit
offset
```

返回结构应包含：

```json
{
  "items": [],
  "total": 96196,
  "limit": 10,
  "offset": 0
}
```

单篇论文建议至少包含：

```json
{
  "id": "论文记录ID",
  "paper_id": "知识底座论文ID",
  "title": "论文标题",
  "authors": [],
  "abstract": "论文摘要",
  "conference": "AAAI",
  "year": 2024,
  "pdf_url": "https://.../paper.pdf"
}
```

首页成功的判断不是只看 HTTP 200，还应确认：

- 首页显示 `知识底座已连接 · remote`。
- 首页显示 `来自知识底座的随机论文 · 10 篇`。
- 论文卡片标记为“远程知识底座”。
- 论文列表不是本地演示数据。

## 十一、论文详情、图谱和 PDF 的 ID 规则

论文详情接口使用知识底座返回的 `paper_id`：

```text
GET /api/kg/paper?paperId={paper_id}
```

`paper_id` 可能包含冒号、斜杠、空格或其他特殊字符，必须进行 URL 编码。例如：

```js
const url = `http://47.110.47.12/api/kg/paper?paperId=${encodeURIComponent(paperId)}`;
```

引用图谱接口：

```text
GET /api/kg/graph?paperId={encoded_paper_id}&depth=1
```

建议 `depth=1`。只有在确实需要更深层关系时才使用 2 或 3，以免增加响应时间和数据量。

图谱中的方向含义为：

- `from` 是当前论文 ID、`to` 是另一论文 ID：当前论文引用另一论文。
- `to` 是当前论文 ID、`from` 是另一论文 ID：另一论文引用当前论文。

论文详情返回的 PDF 字段可能叫 `pdf_url`；本项目会将其转换为前端使用的 `pdfUrl`。点击阅读时，浏览器请求本项目的同源 PDF 代理，而不是直接将知识底座地址暴露给浏览器。

## 十二、Vercel 环境变量的推荐填写模板

### 方案 A：知识底座已经有 HTTPS 地址（推荐）

在 Vercel `Production` 环境填写：

```env
RETRIEVAL_PROVIDER=remote
RETRIEVAL_API_URL=https://knowledge.example.com
RETRIEVAL_API_TOKEN=真实访问令牌
RETRIEVAL_FALLBACK_LOCAL=false
RETRIEVAL_TIMEOUT_SECONDS=30
RETRIEVAL_RETRY_COUNT=1
RETRIEVAL_DEFAULT_TOP_K=10
RETRIEVAL_CIRCUIT_FAILURE_THRESHOLD=3
RETRIEVAL_CIRCUIT_RESET_SECONDS=30
```

这是公网部署的标准方案，不需要设置 `RETRIEVAL_ALLOW_INSECURE_HTTP`。

### 方案 B：临时使用当前 HTTP IP 地址（仅测试）

如果知识底座仍只有当前地址：

```env
RETRIEVAL_PROVIDER=remote
RETRIEVAL_API_URL=http://47.110.47.12
RETRIEVAL_API_TOKEN=真实访问令牌或按服务要求填写
RETRIEVAL_ALLOW_INSECURE_HTTP=true
RETRIEVAL_FALLBACK_LOCAL=false
RETRIEVAL_TIMEOUT_SECONDS=30
RETRIEVAL_RETRY_COUNT=1
RETRIEVAL_DEFAULT_TOP_K=10
```

这会允许 Vercel 生产运行时访问 HTTP，但请求不具备传输加密。只应作为短期联调方案，完成 HTTPS 反向代理后应立即删除 `RETRIEVAL_ALLOW_INSECURE_HTTP`。

## 十三、Token 和 Vercel 的区别

API 手册中的接口示例没有展示认证头，当前知识底座接口可能允许无 Token 访问；但项目仍支持通过以下服务端变量发送 Bearer Token：

```http
Authorization: Bearer <RETRIEVAL_API_TOKEN>
```

在 Vercel 上：

- 如果知识底座要求认证，必须配置有效 Token。
- 如果知识底座明确允许匿名访问，应用代码可以不配置 Token。
- 不要把 Token 写进 URL，因为 URL 可能出现在日志或监控中。
- 不要将 Token 配置为 `NEXT_PUBLIC_RETRIEVAL_API_TOKEN`。

注意：仓库中的 Docker 生产预检脚本会把 `RETRIEVAL_API_TOKEN` 作为必填项；Vercel 不执行该 Docker Compose 预检，但为了统一生产配置和后续迁移，仍建议配置真实 Token。

## 十四、部署后的逐步验证命令

### 1. 验证 Vercel 应用的知识底座状态

PowerShell：

```powershell
$cloud = "https://scinexus-five.vercel.app"
Invoke-WebRequest "$cloud/api/knowledge/health" -UseBasicParsing
```

重点查看返回中的：

```text
status
provider
checks.service
checks.retrieval
runtime
```

### 2. 验证原始知识底座服务

PowerShell：

```powershell
$kb = "https://你的知识底座域名"
Invoke-WebRequest "$kb/api/health" -UseBasicParsing
Invoke-WebRequest "$kb/api/retrieval/health" -UseBasicParsing
Invoke-WebRequest "$kb/api/retrieval/ready" -UseBasicParsing
```

如果暂时使用 HTTP 地址，将 `$kb` 改为：

```powershell
$kb = "http://47.110.47.12"
```

### 3. 验证发现接口返回 10 篇论文

```powershell
Invoke-WebRequest "$cloud/api/v1/knowledge/discover" -UseBasicParsing
```

成功时应看到：

```json
{
  "success": true,
  "data": {
    "results": [
      "..."
    ],
    "meta": {
      "source": "remote_knowledge_base",
      "random": true,
      "count": 10
    }
  }
}
```

### 4. 验证检索接口

```powershell
$body = @{
  query = "graph neural network"
  top_k = 3
  year_gte = 2022
  year_lte = 2026
  conference = @()
  author = @()
  keyword = @()
  subject = @()
} | ConvertTo-Json

Invoke-WebRequest `
  "$cloud/api/v1/knowledge/search" `
  -Method Post `
  -ContentType "application/json" `
  -Body $body `
  -UseBasicParsing
```

### 5. 验证浏览器功能

在首页确认：

1. 状态显示“知识底座已连接 · remote”。
2. 页面出现 10 篇随机论文。
3. 点击一篇论文的“立即阅读”。
4. 详情页显示 PDF 阅读器，而不是 `success:false` JSON。
5. 点击“下载 PDF”可以得到 PDF 响应。
6. 论文图谱页面可以加载引用关系或显示明确的上游不可用状态。

## 十五、状态码与重试策略

知识底座 API 常见状态码：

| 状态码 | 含义 | 处理建议 |
| --- | --- | --- |
| `200` | 请求成功 | 校验返回 JSON 结构后使用 |
| `201` | 创建成功 | 适用于写入类接口 |
| `400` | 参数错误 | 检查查询体和 URL 编码，不要重试 |
| `401` | 未认证或 Token 无效 | 检查 `RETRIEVAL_API_TOKEN` |
| `404` | 论文或资源不存在 | 检查 `paperId`，不要重试 |
| `413` | 请求内容过大 | 减少请求内容或数量 |
| `429` | 请求过于频繁 | 延迟后重试并检查频率限制 |
| `500` | 上游内部错误 | 间隔后重试 1 次 |
| `503` | 上游暂不可用 | 检查 ready 状态，间隔后重试 1 次 |

本项目默认请求超时为 30 秒，自动重试最多 1 次，并使用熔断机制避免上游持续故障拖垮 Vercel 请求。出现 `degraded` 或 `unavailable` 时，应先查看 `/api/knowledge/health` 返回的具体检查项。

## 十六、最终配置检查清单

在宣布云端知识底座配置完成前，逐项确认：

- [ ] Vercel `Production` 环境已配置 `RETRIEVAL_PROVIDER=remote`。
- [ ] `RETRIEVAL_API_URL` 是可从公网访问的知识底座基础地址。
- [ ] 生产优先使用 HTTPS；若使用 HTTP，已明确这是临时测试配置。
- [ ] 按知识底座要求配置了 `RETRIEVAL_API_TOKEN`。
- [ ] 未使用任何 `NEXT_PUBLIC_` 前缀暴露 Token。
- [ ] 已执行新的 Vercel 部署，而不是只保存变量。
- [ ] `/api/knowledge/health` 不再返回“知识底座尚未配置”。
- [ ] `/api/v1/knowledge/discover` 返回 10 篇远程论文。
- [ ] 首页状态标记为 `remote`。
- [ ] 至少打开一篇论文，确认 PDF 阅读器实际加载。
- [ ] 检查 Vercel Function Logs 中没有持续的超时、401、429 或 5xx。
