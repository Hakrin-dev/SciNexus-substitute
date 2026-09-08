# 论文检索与知识图谱 API 使用手册

## 1. 基本信息

服务地址：

```text
http://47.110.47.12
```

接口统一返回 JSON。发送 POST 请求时使用：

```http
Content-Type: application/json
```

## 2. 论文检索

### 增强检索

```http
POST /api/retrieval/search
```

完整地址：

```text
http://47.110.47.12/api/retrieval/search
```

用于根据标题、摘要和论文元数据检索论文，支持中英文查询（中文查询十分有限）、模糊匹配和条件过滤。

请求示例：

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

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `query` | string | 是 | 查询内容 |
| `top_k` | integer | 否 | 返回数量，默认 10，建议不超过 20 |
| `year_gte` | integer | 否 | 最早发表年份 |
| `year_lte` | integer | 否 | 最晚发表年份 |
| `conference` | string[] | 否 | 会议名称列表 |
| `author` | string[] | 否 | 作者列表 |
| `keyword` | string[] | 否 | 关键词列表 |
| `subject` | string[] | 否 | 主题列表 |

也可以使用 GET 快速查询：

```http
GET /api/retrieval/search?q=graph%20neural%20network&top_k=10
```

返回示例：

```json
{
  "results": [
    {
      "paper_id": "paper:17203_aaai:911ff38f19e8",
      "title": "GraphMix: Improved Training of GNNs...",
      "abstract": "We present GraphMix...",
      "conference": "AAAI",
      "year": 2021,
      "authors": [],
      "keywords": [],
      "subjects": [],
      "score": 0.022,
      "rank": 1
    }
  ],
  "state": {},
  "query_parse": {},
  "query_rewrite": {}
}
```

结果已按相关性排序。建议使用返回顺序或 `rank`，不要把 `score` 当成百分比。

### 多步关系检索（暂不建议使用）

```http
POST /api/retrieval/multistep-search
```

用于包含作者、主题或其他关系约束的复杂查询。

```json
{
  "query": "查找同一作者在相同主题下的其他论文",
  "top_k": 10,
  "max_steps": 6
}
```

普通论文搜索优先使用 `/api/retrieval/search`。

## 3. 论文详情

```http
GET /api/kg/paper?paperId={paper_id}
```

`paper_id` 从论文检索结果中取得。调用时需要进行 URL 编码。

示例：

```js
const url = `http://47.110.47.12/api/kg/paper?paperId=${encodeURIComponent(paperId)}`;
const response = await fetch(url);
const paper = await response.json();
```

返回示例：

```json
{
  "paper_id": "paper:17203_aaai:911ff38f19e8",
  "title": "...",
  "authors": [],
  "year": 2021,
  "venue": "AAAI",
  "abstract": "...",
  "doi": "...",
  "pdf_url": "..."
}
```

## 4. 引用和知识图谱

```http
GET /api/kg/graph?paperId={paper_id}&depth=1
```

参数：

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `paperId` | 是 | 检索结果中的论文 ID |
| `depth` | 否 | 图谱展开深度，可选 1 至 3，建议使用 1 |

返回示例：

```json
{
  "rootId": "当前论文ID",
  "nodes": [],
  "lines": [
    {
      "from": "论文A",
      "to": "论文B",
      "text": "CITES",
      "data": {
        "type": "CITES"
      }
    }
  ]
}
```

引用方向：

- `from` 是当前论文 ID：当前论文引用了 `to` 对应的论文。
- `to` 是当前论文 ID：`from` 对应的论文引用了当前论文。

图谱还可能返回作者、机构、方法、基金、主题和会议等节点及关系。

## 5. 简单标题检索

```http
GET /api/kg/search?q={关键词}&limit=20
```

用于在知识图谱中按论文标题查找论文。

| 参数 | 说明 |
| --- | --- |
| `q` | 标题关键词 |
| `limit` | 返回数量，范围 1 至 50，默认 20 |

需要检索标题和摘要时，应使用 `/api/retrieval/search`。

## 6. 论文和会议信息

### 论文列表

```http
GET /api/papers
```

可选参数：

```text
q, conference, year, track, limit, offset
```

示例：

```http
GET /api/papers?q=graph&conference=AAAI&year=2024&limit=20&offset=0
```

### 其他信息

```http
GET /api/papers/venues
GET /api/papers/tracks?conference=AAAI
GET /api/categories
GET /api/conferences
```

## 7. 用户和收藏

```http
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me
GET    /api/favorites
POST   /api/favorites
DELETE /api/favorites/{conferenceId}
```

登录请求示例：

```json
{
  "username": "username",
  "password": "password"
}
```

添加收藏：

```json
{
  "conferenceId": "conference-id"
}
```

登录状态使用 Cookie。浏览器请求需要设置：

```js
fetch(url, {
  credentials: "include"
});
```

## 8. 服务状态

```http
GET /api/health
GET /api/retrieval/health
GET /api/retrieval/ready
```

- `/api/health`：检查主业务服务。
- `/api/retrieval/health`：检查检索服务进程。
- `/api/retrieval/ready`：检查检索服务是否准备完成。

## 9. 状态码

| 状态码 | 说明 |
| --- | --- |
| `200` | 请求成功 |
| `201` | 创建成功 |
| `400` | 参数错误或缺少必填参数 |
| `401` | 未登录或认证失败 |
| `404` | 论文或资源不存在 |
| `413` | 请求内容过大 |
| `429` | 请求过于频繁 |
| `500` | 服务内部错误 |
| `503` | 服务暂时不可用 |

建议将请求超时设置为 30 秒。遇到 `500` 或 `503` 时，可以间隔一段时间重试 1 至 2 次；`400` 和 `404` 不需要重试。
