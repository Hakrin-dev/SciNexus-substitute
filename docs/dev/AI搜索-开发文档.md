# 开发文档 · AI 搜索

> 面向系统平台开发人员。配套 PRD:[../prd/PRD-AI搜索.md](../prd/PRD-AI搜索.md)。
> 本文定义会话/生成 API、流式协议、引用数据契约、检索与生成管线、前端对接点。接口前缀 `/api/v1`,鉴权同用户系统(`Authorization: Bearer`)。

---

## 1. 总体架构

```
发现页 SearchHero ──跳转──► /agents/deep-search?q=...
                                │
        ┌───────────────────────┼─────────────────────────┐
        ▼                       ▼                         ▼
  会话服务 (REST)          生成网关 (SSE 流式)          上传/引用服务
  sessions CRUD            模式路由/配额/并发控制        文件解析/arXiv 拉取
        │                       │                         │
        ▼                       ▼                         ▼
   PostgreSQL            检索层(知识库/专利库/          对象存储 + 解析队列
   sessions/messages      学者库/机构库 + 联网搜索)      (PDF→文本)
                                │
                                ▼
                        模型层(默认/订阅/用户 API Key)
```

关键约束:

- **引用真实性由管线保证**:生成阶段模型只能引用检索阶段返回的 `ref_id` 集合;输出后校验 [N] 编号与来源列表一一对应,校验失败重生成一次,仍失败则降级为「无引用回答 + 明确说明」;
- 追问**不重跑全量检索**:沿用会话已有上下文,仅对新问题增量检索;
- 未登录请求走匿名配额(IP 粒度),会话不写库。

---

## 2. 数据模型

### 2.1 `chat_sessions`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid PK | |
| user_id | uuid FK | 未登录会话不落库 |
| type | varchar(16) | `research`(深度搜索)/ `chat`(AI 助手),两栏各自过滤 |
| title | text | 默认取首问前 30 字,可重命名 |
| mode | varchar(8) | 当前模式:`fast / deep / idea / doubt` |
| model | varchar(16) | `default / subscription / byok`(用户 API Key) |
| web_search | bool | 联网搜索开关 |
| share_token | varchar(64) NULL | 分享链接 token,UNIQUE |
| share_expires_at | timestamptz | 分享创建 +7 天;取消分享置 NULL |
| last_active_at | timestamptz | 列表排序键 |
| created_at | timestamptz | |

索引:`(user_id, type, last_active_at DESC)`、`(share_token)`。

### 2.2 `chat_messages`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid PK | |
| session_id | uuid FK | |
| role | varchar(8) | `user / assistant` |
| content | text | 用户问题,或助手 Markdown 正文(含 `[N]` 标记) |
| mode / model | varchar | 该轮实际使用的模式与模型(追问可切换) |
| attachments | jsonb | `[{kind, ref_id \| file_id, title}]`,见 §5 |
| status | varchar(16) | `streaming / done / failed / stopped` |
| stats | jsonb | `{ "read_count": 28, "duration_ms": 4200 }`(头部「已阅读 N 篇 · 耗时 Xs」) |
| created_at | timestamptz | |

### 2.3 `message_references`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| message_id | uuid FK | |
| ordinal | int | 即正文中的 N,与 [N] 一一对应,连续从 1 开始 |
| source_type | varchar(16) | `paper / patent / funding / scholar / institution / web` |
| source_id | varchar(64) | 平台内实体 ID(web 类型为 URL) |
| title / venue / authors / citation_count | | 来源卡片展示字段,检索时快照 |
| recommended | bool | 系统重点推荐(琥珀色高亮卡片) |

UNIQUE (message_id, ordinal)。

### 2.4 `upload_files`

| 字段 | 说明 |
| --- | --- |
| id / user_id / session_id | |
| filename / mime / size | 单文件 ≤20MB |
| parse_status | `pending / ok / failed` |
| parsed_text_ref | 解析结果对象存储 key;**会话删除时级联删除** |

---

## 3. API 规范

通用响应包络同用户系统;AI 搜索业务码段位 `2xxxx`(见 §8)。

### 3.1 创建会话 `POST /search/sessions`

```json
{
  "type": "research",
  "question": "扩散模型在机器人策略学习中最近 6 个月有哪些突破性进展?",
  "mode": "deep",
  "model": "default",
  "web_search": false,
  "attachments": [{ "kind": "file", "file_id": "uuid" }, { "kind": "paper", "ref_id": "dp3-2025" }]
}
```

- `question`:1–2000 字,trim 后非空 → `20001`;
- 配额校验:未登录(IP)每日 3 次仅 `fast`;免费用户每日 20 次且 `deep` ≤ 5;超限 → `20002`(前端弹订阅/登录引导);
- 并发校验:同用户 `streaming` 中消息 ≤2,否则 → `20003`;
- 响应:`{ "session_id": "...", "message_id": "..." }`,随后前端立刻打开 §3.3 的流。

### 3.2 追问 `POST /search/sessions/{id}/messages`

请求体同 3.1 去掉 `type`;mode/model/web_search 未传则继承会话当前值。
`deep` 模式追问沿用已有检索上下文,仅增量检索。

### 3.3 流式生成 `GET /search/messages/{id}/stream`(SSE)

`Accept: text/event-stream`。事件序列:

```
event: meta      data: {"read_count": 28, "phase": "generating"}
event: delta     data: {"text": "过去 6 个月,"}        # 正文增量,可含 [N]
event: delta     data: {"text": "扩散策略 [1] 已经..."}
event: refs      data: {"references": [ {...§4 来源对象...} ]}   # 正文结束后
event: followups data: {"items": ["RDT-1B 与 Octo 的性能差异?", ...]}  # 3–5 条
event: done      data: {"duration_ms": 4200, "status": "done"}
```

异常:

```
event: error     data: {"code": 20004, "message": "生成中断,点击继续"}
```

- 断线续传:重连带 `Last-Event-ID`,服务端从断点继续;无法续传时前端调 `POST /search/messages/{id}/resume` 重发;
- 停止:`POST /search/messages/{id}/stop`,已生成部分保留,status=`stopped`;
- 服务端须做**引用校验**(见 §1)再发 `refs`;
- 未登录会话的流不落库,`meta` 中带 `"ephemeral": true`。

### 3.4 会话与历史

| 接口 | 说明 |
| --- | --- |
| `GET /search/sessions?type=research&limit=20&cursor=...` | 近期研究/历史列表;返回 `{id, title, last_active_at, ref_count}`,ref_count = 该会话最近一条 done 消息的来源数 |
| `GET /search/sessions/{id}` | 会话详情:消息数组 + 每条消息的 references/followups/attachments |
| `PATCH /search/sessions/{id}` | 重命名 `{title}` |
| `DELETE /search/sessions/{id}` | 删除会话,级联删消息、引用快照、上传文件解析结果 |
| `POST /search/sessions/{id}/share` | 生成 share_token,返回 `{ "url": "https://.../share/<token>" }` |
| `DELETE /search/sessions/{id}/share` | 取消分享 |
| `GET /share/{token}`(公开) | 只读视图数据;过期/取消 → 404,前端展示「该分享已失效」 |

### 3.5 配置下发 `GET /search/config`

进入结果页时拉取一次:

```json
{
  "models": [{ "value": "default", "label": "默认", "enabled": true },
             { "value": "subscription", "label": "订阅", "enabled": false, "reason": "not_subscribed" },
             { "value": "byok", "label": "API接入", "enabled": false, "reason": "no_api_key" }],
  "modes": ["fast", "deep", "idea", "doubt"],
  "quota": { "used": 3, "limit": 20, "deep_used": 1, "deep_limit": 5 },
  "upload": { "max_size_mb": 20, "max_files": 5, "accept": [".pdf", ".docx", ".md", ".txt"] }
}
```

前端据此禁用无权限选项并给出引导。

### 3.6 保存到知识库 / 反馈

| 接口 | 说明 |
| --- | --- |
| `POST /search/messages/{id}/save-to-library` | `{ "title?": "..." }`,将该轮问答(含引用)存入「我的笔记」,返回笔记 ID |
| `POST /search/messages/{id}/feedback` | `{ "type": "like" \| "dislike", "reasons?": ["引用不准", "答非所问"], "comment?": "..." }` |

---

## 4. 引用数据契约(前后端共用)

`refs` 事件中每个来源对象:

```json
{
  "ordinal": 3,
  "source_type": "paper",
  "source_id": "rdt-1b",
  "title": "RDT-1B: A Diffusion Foundation Model for Robotic Manipulation",
  "venue": "ICML 2026",
  "org": null,
  "authors": "Liu et al.",
  "citation_count": 312,
  "recommended": true,
  "url": null
}
```

- `ordinal` 从 1 连续编号;正文中的 `[3]` 与此对象对应;
- 平台内来源(`paper/patent/...`)前端跳 `/papers/<source_id>` 等详情页;`web` 类型用 `url` 新窗口打开,卡片加「网页」标签;
- 卡片左上角圆形编号底色按 `source_type` 映射(原型 `TONE_COLORS`:violet/green/amber/gray),推荐卡片用琥珀高亮边框。

---

## 5. 附件与引用(别针菜单)

### 5.1 上传

1. `POST /uploads`(multipart)→ `{ "file_id": "..." }`,立即返回,解析异步;
2. `GET /uploads/{file_id}` 轮询或 SSE 推送解析状态;`failed` 时前端 chip 标红「解析失败」,不阻塞发送(该附件自动剔除并提示);
3. 文件夹上传:前端 `webkitdirectory` 多选,过滤格式与数量(≤50),逐个走同一接口;
4. arXiv 链接:发送时后端识别正文中的 `arxiv.org/abs/<id>`,拉取全文生成临时 `file_id`,归入驻会话上下文,响应 `meta` 中告知 `{"arxiv_resolved": 1}`。

### 5.2 引用实体

`attachments` 数组元素:

| kind | ref_id | 说明 |
| --- | --- | --- |
| `paper` / `patent` / `funding` / `scholar` / `institution` | 平台实体 ID | 知识库引用,生成时注入该实体全文/结构化摘要 |
| `session` | 历史会话 ID | 注入该会话问答摘要(上限 4000 token) |
| `project` | 项目 ID | 注入项目简介 + 里程碑 |
| `file` | 上传文件 ID | 注入解析全文 |

- 引用列表面板数据直接复用各库既有列表接口(`/knowledge/*`、`/projects`),前端别针菜单二级面板已按此分组;
- 上下文总量上限 100k token,超出按注入顺序截断并在 `meta` 中返回 `{"context_truncated": true}`。

---

## 6. 检索与生成管线(后端内部)

```
question + attachments
   │ 1. 上下文装配:注入引用实体/历史摘要,arXiv/文件全文
   ▼
2. 检索:
   - fast:向量检索 top-5
   - deep:多路召回(向量 + 关键词 + 学者/机构图谱扩展)top-40 → 重排取 top-20+
   - idea/doubt:同 deep,提示词目标不同
   - web_search=true 时追加联网检索结果,标记 source_type=web
   ▼
3. 生成:提示词限定「只能使用给定来源,论断句末标 [ordinal]」
   ▼
4. 校验:[N] 集合 == refs 集合且连续;失败重生成 1 次,再失败降级(去引用 + 明示)
   ▼
5. 追问建议:基于会话上下文生成 3–5 条,去重已问内容
```

- 模式路由:`fast/deep/idea/doubt` → 不同提示词模板与检索参数;`model=subscription` 换高性能模型;`model=byok` 用用户 Key 直连(服务端代理转发,Key 从用户系统加密存储读取,不落日志);
- 「自动更新中」:deep 会话按主题建立监控任务,新文献入库时通知(user_id, session_id, new_count),顶栏红点提示,点击后以新来源重新生成追加段落。

---

## 7. 前端对接说明(本仓库改动点)

| 原型位置 | 当前状态 | 改造要求 |
| --- | --- | --- |
| `components/features/search/search-hero.tsx` | 跳转带 `?q=` | 保留;模式/模型选择随 URL 或 sessionStorage 传到结果页 |
| `components/features/agent/composer.tsx` | 菜单纯演示 | 模型/模式选项从 `GET /search/config` 渲染;发送接 3.1/3.2 |
| `app/agents/deep-search/page.tsx` | 静态组装 | 消费 `?q=`:无 session 时先 3.1 建会话;有 `?session=` 直接 3.4 拉详情 |
| `answer-card.tsx` | 写死内容 | 渲染 SSE delta 流(打字机);头部 stats 取 `meta`/`done` 事件;操作条(复制/重生成/存库/赞踩)按 PRD §3.2.4 新增 |
| `lib/citations.tsx` `withCitations()` | 上标样式 | 改为 `<sup>` 锚点:点击滚动到对应参考卡片并高亮(`scrollIntoView` + 短暂背景闪烁) |
| `reference-grid.tsx` | 写死 10 篇 | 渲染 `refs` 事件数据;「查看全部」>8 篇时展开完整列表 |
| `follow-ups.tsx` | 写死 5 条 | 渲染 `followups` 事件;点击即调 3.2 发送 |
| `research-nav.tsx` | 写死列表 | `GET /search/sessions?type=research`;「开启新研究」清空 `?session=`;加「···」重命名/删除菜单 |
| `agent-chat.tsx` | `MOCK_REPLY` 定时器 | 同一套接口,`type=chat`;历史列表 `type=chat` 过滤 |
| `chat-input.tsx` | 说明文案静态 | 不变;菜单方向 `up` 已支持 |
| `lib/validations.ts` `searchSchema` | 仅前端非空校验 | 上限改为 2000 字,与接口一致 |

SSE 客户端:新建 `lib/sse.ts` 封装 EventSource(fetch 流式,支持 POST 升级与 Last-Event-ID),React Query 管理非流式数据,流式消息状态用本地 reducer 缓冲、done 后写入 query cache。

---

## 8. 业务错误码(2xxxx)

| code | 场景 | 用户文案 |
| --- | --- | --- |
| 20001 | 问题为空/超长 | 请输入 2000 字以内的问题 |
| 20002 | 配额用尽 | 今日次数已用完,订阅可解锁更多额度 |
| 20003 | 并发超限 | 当前有正在生成的回答,请稍候 |
| 20004 | 生成中断/超时 | 生成中断,点击继续 |
| 20005 | 无检索来源 | 未找到足够相关的文献,建议换个问法或开启联网搜索 |
| 20006 | 附件超限 | 单文件不超过 20MB,单次最多 5 个 |
| 20007 | 附件解析失败 | 部分附件解析失败,已从本次提问中移除 |
| 20008 | 内容安全拦截 | 该问题暂无法回答 |
| 20009 | 模型权限不足 | 当前模型需要订阅或在设置页配置 API Key |
| 20010 | 分享已失效 | 该分享已失效 |

---

## 9. 测试要点

- 单测:引用校验器([N] 与 refs 一致性、连续性、重生成降级);附件 token 截断;配额/并发判定;
- 契约测试:refs/followups/meta 事件 schema;share 只读视图;
- 管线回归集:20 条固定问题 × 4 模式,断言引用率(有来源论断占比)、引用正确率(人工抽检)、首字延迟;
- 前端:断线续传、停止生成保留已输出、未登录配额拦截弹窗、arXiv 链接识别、别针菜单三种引用的 chip 回显与删除。
