# 研枢 SciNexus · 部署文档

> 架构:Docker Compose + GitHub Actions 构建推镜像,ECS 上 Watchtower 拉取式自动更新。
> 镜像仓库:GitHub Container Registry(ghcr.io)。
> **2026-08-07 起:部署改为拉取式,CI 不再 SSH 入站**(当日安全组收紧导致 SSH 部署失败,故改造)。

---

## 一、架构总览

```
GitHub push (main)
   │
   ▼
GitHub Actions ──build + push 镜像──▶ GHCR (ghcr.io/hakrin-dev/scinexus-frontend / scinexus-backend)
                                          │  ▲
                                          │  │ 每 60s 轮询 latest 的 digest
                                          ▼  │
                              ECS: Watchtower ── 发现新 digest ──▶ pull + 重建 web
                                          │
                                          ▼
                              http://47.76.187.249        (80  → web:3000)
                               http://47.76.187.249:8000   (8000 → api:8000,前端 JS 直连, CORS 全开)
```

| 组件 | 说明 |
|---|---|
| `web` | Next.js standalone server,监听 3000,compose 映射到宿主机 80 |
| `api` | FastAPI + 多智能体后端,监听 8000;数据目录挂载 `/opt/scinexus/data → /app/data` |
| `watchtower` | 每 60s 轮询 GHCR,镜像有更新自动 pull + 重建 `web`(nicholas-fedor 维护分支) |
| GHCR | GitHub Container Registry,私有镜像免费 |
| GitHub Actions | push 到 main 自动:构建 → 推镜像(含 sha tag + revision label) |

> Watchtower 靠 digest 判断更新;CI 每次构建都写入 `org.opencontainers.image.revision` 标签,
> 保证即使应用代码没变,digest 也必然变化,更新检测不会漏。
> `api` 服务**不**纳入 Watchtower(标签 `watchtower.enable=false`),后端更新在 ECS 手动执行。

---

## 二、一次性初始化

### 2.1 ECS
- 阿里云香港;镜像:Ubuntu 22.04 LTS;规格 2c4g
- 公网 IP:`47.76.187.249`,私网:`172.24.228.171`
- 安全组入方向:80 必须;**22 只放行自己的 IP / Tailscale**(CI 不需要 SSH 入站)
- ⚠️ 阿里云内网 DNS(100.100.2.136/138)曾整体失联导致 ghcr.io 解析超时,初始化时
  已用 `/etc/netplan/60-dns-override.yaml` 把 DNS 固定为 `223.5.5.5` + `8.8.8.8`

### 2.2 Docker + Compose(初始化时安装)
```bash
docker --version
docker compose version
```

### 2.3 镜像仓库:GHCR(GitHub Container Registry)
- 镜像地址:`ghcr.io/hakrin-dev/scinexus-frontend`(私有)
- 由 GitHub Actions 自动构建推送(GITHUB_TOKEN 免密)
- ECS 上 root 已 `docker login ghcr.io`(用 GHCR_PAT),凭证在 `/root/.docker/config.json`,Watchtower 挂载复用
- ⚠️ GHCR_PAT 若过期,ECS 会拉不到新镜像 → 需重新登录;或将 Package 设为 Public(见 7.1 节)

### 2.4 SSH 密钥(仅运维用,CI 不再使用)
- 本地 `~/.ssh/scinexus_ecs`(私钥)+ `scinexus_ecs.pub`(公钥已放到 ECS)
- 验证:`ssh -i ~/.ssh/scinexus_ecs root@47.76.187.249`

---

## 三、GitHub Secrets

CI 现在只需要 GitHub 自动注入的 `GITHUB_TOKEN`,**无需任何仓库 Secret**。
旧的 `ECS_HOST` / `ECS_SSH_KEY` / `GHCR_PAT` 已不再被 workflow 引用,可在 Settings 中删除
(`GHCR_PAT` 本身仍用于 ECS 上的 docker login,别吊销 PAT 本体)。

---

## 四、ECS 上的部署目录

`/opt/scinexus/docker-compose.yml` 与仓库根目录 `docker-compose.yml` 一致(仓库为唯一事实来源,
改动后需手动同步到 ECS 并 `docker compose up -d`)。内容见仓库根目录文件,要点:

- `web`:带 `com.centurylinklabs.watchtower.enable=true` 标签,纳入 Watchtower 监控;
- `api`:带 `com.centurylinklabs.watchtower.enable=false` 标签,手动更新;数据挂载见第五节;
- `watchtower`:`--interval 60 --cleanup --label-enable`,只监控带标签的容器,更新后自动清旧镜像。

---

## 五、后端 api 服务部署(真实 AI 对话)

### 5.1 一次性初始化(ECS 上执行)

> **先跑通模式(不上传数据)**:以下 ② 可整段跳过,直接执行 ③④⑤⑥。
> 空 volume 下后端自动回退镜像内置演示论文库(mock_data.py,p1-p11 共 11 篇),
> 并在 `/app/data` 自动生成 research.sqlite —— AI 对话/检索/翻译均可用,回答基于演示论文语料。

```bash
# ① 数据目录(存放 research.sqlite / embeddings.json / pdfs / papers;先跑通可只建目录)
mkdir -p /opt/scinexus/data
```

```bash
# ② 本机执行(可选,先跑通可跳过):把后端数据上传到 ECS
#    research.sqlite / pdfs / papers / embeddings.json 全部被 .gitignore 忽略,
#    不入库、不入镜像,必须手动 scp;缺了会自动回退 mock 数据
scp -i ~/.ssh/scinexus_ecs backend/server/data/research.sqlite root@47.76.187.249:/opt/scinexus/data/
scp -i ~/.ssh/scinexus_ecs backend/server/data/embeddings.json root@47.76.187.249:/opt/scinexus/data/
scp -r -i ~/.ssh/scinexus_ecs backend/server/data/pdfs  root@47.76.187.249:/opt/scinexus/data/
scp -r -i ~/.ssh/scinexus_ecs backend/server/data/papers root@47.76.187.249:/opt/scinexus/data/
```

```bash
# ③ 创建 .env(DeepSeek key 等;compose 自动读取同目录 .env 做变量插值)
cat > /opt/scinexus/.env << 'EOF'
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
OPENAI_BASE_URL=https://api.deepseek.com/v1
LLM_MODEL=deepseek-chat
LLM_PROVIDER=openai
EOF
chmod 600 /opt/scinexus/.env
```

```bash
# ④ 同步 docker-compose.yml(仓库根目录为唯一事实来源,已含 api 服务)
#    先从本地 scp 上去,或直接在 ECS 上编辑:
scp -i ~/.ssh/scinexus_ecs docker-compose.yml root@47.76.187.249:/opt/scinexus/
```

```bash
# ⑤ 先确认后端镜像已推 GHCR(Actions build-and-push-backend 绿),再拉取启动
cd /opt/scinexus
docker compose pull api
docker compose up -d
```

```bash
# ⑥ 安全组(阿里云控制台):入方向放行 TCP 8000,来源 0.0.0.0/0
```

### 5.2 验证

```bash
# 容器内健康检查
docker compose -f /opt/scinexus/docker-compose.yml ps        # api 应为 healthy
docker compose -f /opt/scinexus/docker-compose.yml logs --tail 50 api

# 后端健康(容器内 + 公网 8000)
curl http://127.0.0.1:8000/api/health
curl http://47.76.187.249:8000/api/health

# 真实检索测试:必须走 8000 端口
# ⚠️ http://47.76.187.249/api/... 会打到前端(80),Next 没有 /api 反代,会 404
curl http://47.76.187.249:8000/api/search -X POST -H 'Content-Type: application/json' -d '{"query":"transformer"}'

# 线上 http://47.76.187.249 的 AI 助手页提问,应返回真实 AI 回答而非「智能体服务暂时不可用」兜底文案
```

### 5.3 日常更新(后端)

```bash
# 前端仍由 Watchtower 自动更新;后端手动:
cd /opt/scinexus
docker compose pull api && docker compose up -d api
```

### 5.4 先跑通模式的说明与后续接入真实数据

| 项 | 先跑通模式(空 volume)表现 | 说明 |
|---|---|---|
| 论文/期刊数据 | 内置演示论文库 11 篇(mock_data.py) | 首次启动自动在 volume 生成 research.sqlite |
| 检索 | 可用,BM25 词法检索 | 无 embeddings.json 且未部署 Ollama → 语义检索降级词法 |
| PDF 全文页 | 回退为摘要 + 结构化分析 | 无 pdfs/ 目录 |
| AI 对话/翻译 | 可用,基于演示语料回答 | 需 `.env` 配好 DeepSeek key |

后续要接真实数据库(任选其一,无需改代码):
```bash
# 方式 A:整库覆盖 —— 上传真实 research.sqlite 后重启生效
scp -i ~/.ssh/scinexus_ecs backend/server/data/research.sqlite root@47.76.187.249:/opt/scinexus/data/
ssh -i ~/.ssh/scinexus_ecs root@47.76.187.249 "cd /opt/scinexus && docker compose restart api"

# 方式 B:完整数据(推荐,检索质量最好)—— 补传 embeddings.json / pdfs / papers 后同样重启
scp -i ~/.ssh/scinexus_ecs backend/server/data/embeddings.json root@47.76.187.249:/opt/scinexus/data/
scp -r -i ~/.ssh/scinexus_ecs backend/server/data/pdfs  root@47.76.187.249:/opt/scinexus/data/
scp -r -i ~/.ssh/scinexus_ecs backend/server/data/papers root@47.76.187.249:/opt/scinexus/data/
ssh -i ~/.ssh/scinexus_ecs root@47.76.187.249 "cd /opt/scinexus && docker compose restart api"
```
> 重启后 agent 会重新读库并重建索引;先跑通期间自动生成的 research.sqlite 会被真实库覆盖
> (agent 启动时对 papers/venues 表做 DELETE+全量重写,paper_analysis 表保留)。
> 容器重启后**首次**检索/对话会懒加载 agent 并构建索引,稍慢(数秒),之后正常;
> 镜像未装 sentence-transformers,交叉编码器重排自动跳过(不下载模型),检索质量以 RRF 混合分数兜底。

---

## 六、日常迭代流程

### 6.1 改代码后自动部署
```bash
git add -A && git commit -m "changes" && git push origin main
```
GitHub Actions 构建并推镜像(约 2~4 分钟);Watchtower 在 60s 轮询周期内发现更新,自动 pull + 重建。
**全程约 3~5 分钟线上生效,Actions 变绿不代表已上线,以 curl 验证为准。**

### 6.2 查看部署状态
- GitHub 仓库 → **Actions** 标签页 → 最新 workflow 是否绿(绿 = 镜像已推 GHCR)
- 线上验证(真正生效):`curl -s http://47.76.187.249/ | head -c 200` 或访问具体页面

### 6.3 ECS 端检查
```bash
ssh -i ~/.ssh/scinexus_ecs root@47.76.187.249
docker compose -f /opt/scinexus/docker-compose.yml ps                # web / api / watchtower 状态
docker logs scinexus-watchtower-1 --tail 20                          # Watchtower 轮询/更新记录
docker compose -f /opt/scinexus/docker-compose.yml logs --tail 50 web
curl -I http://127.0.0.1/                                           # 本地验证 200
```

### 6.4 回滚到上一个版本
```bash
cd /opt/scinexus
docker compose up -d --no-deps web ghcr.io/hakrin-dev/scinexus-frontend:<旧sha>
# 注意:Watchtower 会把它再升回 latest;回滚期间先停 watchtower:
# docker compose stop watchtower,回滚验证完再 docker compose start watchtower
```

---

## 七、后续扩展(规划中)

### 7.1 将 GHCR 镜像设为 Public(可选)
1. 访问 `https://github.com/users/Hakrin-dev/packages/container/package/SciNexus-substitute`
2. **Package settings** → Change visibility → **Public**
3. 之后 ECS 拉取无需登录,GHCR_PAT 过期也不受影响

### 7.2 接入真实后端 + 数据库
在 `docker-compose.yml` 追加 service(api / postgres / redis 等);
不需要自动更新的服务**不要**加 watchtower 标签(已用 `--label-enable` 白名单机制)。
前端通过 `NEXT_PUBLIC_API_URL` 指向 api 服务(已接入,见第五节)。

### 7.3 HTTPS + 域名
- 加 nginx/caddy service 到 compose,443 已在安全组放行

---

## 八、常见问题

| 问题 | 处理 |
|---|---|
| Actions 失败,Login to GHCR 报错 | 检查 workflow 是否有 `permissions: packages: write`;GITHUB_TOKEN 自动注入无需配置 |
| Actions 绿但线上没更新 | `docker logs scinexus-watchtower-1` 看轮询是否报错(GHCR 凭证过期 → 重新 docker login);或镜像 digest 未变(确认 revision label 存在) |
| Watchtower 报 `client version too old` | 镜像要用 `ghcr.io/nicholas-fedor/watchtower`,containrrr 官方版已归档不兼容 Docker 29 |
| ECS `docker compose pull` 报 denied/not found | root 的 ghcr.io 登录失效 → 重新 `docker login`;或将 Package 设为 Public(7.1) |
| 构建失败 Module not found brand/... | 确认 `.dockerignore` **没有排除** `brand/logo-wordmark.png`(被 `components/layout/logo.tsx` 静态导入) |
| 访问 http://IP 打不开 | 安全组 80 是否放行;`docker compose ps` 是否 healthy;`curl -I http://127.0.0.1/` 是否 200 |
| api 容器 unhealthy 或重启 | `docker logs api` 看 SQLite 报错(`attempt to write a readonly database` = 挂载漏了 rw 或路径不对);确认 `/opt/scinexus/data` 挂到容器 `/app/data` 且 `TOOL_DATA_DIR=/app/data` |
| 线上 AI 回复仍是「智能体服务暂时不可用」 | 后端 agent 异常回退 mock 了:① `docker compose logs api` 是否有 agent 异常;② `.env` 里 OPENAI_API_KEY/LLM_PROVIDER 是否生效(`docker compose exec api env \| grep LLM`);③ 若只是检索结果偏少/基于演示论文,属先跑通模式正常表现(见 5.4),不是兜底文案 |
| `curl http://47.76.187.249/api/search` 404 | 正确地址是 `http://47.76.187.249:8000/api/search`;80 端口是前端,没有 /api 反代 |
