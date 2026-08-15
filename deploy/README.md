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
GitHub Actions ──build + push 镜像──▶ GHCR (ghcr.io/hakrin-dev/scinexus-frontend)
                                          │  ▲
                                          │  │ 每 60s 轮询 latest 的 digest
                                          ▼  │
                              ECS: Watchtower ── 发现新 digest ──▶ pull + 重建 web
                                          │
                                          ▼
                              http://47.76.152.223 (80 → web:3000)
```

| 组件 | 说明 |
|---|---|
| `web` | Next.js standalone server,监听 3000,compose 映射到宿主机 80 |
| `watchtower` | 每 60s 轮询 GHCR,镜像有更新自动 pull + 重建 `web`(nicholas-fedor 维护分支) |
| GHCR | GitHub Container Registry,私有镜像免费 |
| GitHub Actions | push 到 main 自动:构建 → 推镜像(含 sha tag + revision label) |

> Watchtower 靠 digest 判断更新;CI 每次构建都写入 `org.opencontainers.image.revision` 标签,
> 保证即使应用代码没变,digest 也必然变化,更新检测不会漏。

---

## 二、一次性初始化(已完成 ✅)

### 2.1 ECS
- 阿里云;镜像:Ubuntu 22.04 LTS;规格 2c4g + 2G swap
- 公网 IP:`47.76.152.223`
- 安全组入方向:80 / 443 必须;**22 现在可以只放行自己的 IP**(CI 不再需要 SSH 入站)

### 2.2 Docker + Compose(已在 ECS 装好)
```bash
docker --version          # Docker 29.7.1 ✅
docker compose version    # Compose v5.4.0 ✅
free -h                   # Swap 2.0G ✅
```

### 2.3 镜像仓库:GHCR(GitHub Container Registry)
- 镜像地址:`ghcr.io/hakrin-dev/scinexus-frontend`(私有)
- 由 GitHub Actions 自动构建推送(GITHUB_TOKEN 免密)
- ECS 上 root 已 `docker login ghcr.io`(用 GHCR_PAT),凭证在 `/root/.docker/config.json`,Watchtower 挂载复用
- ⚠️ GHCR_PAT 若过期,ECS 会拉不到新镜像 → 需重新登录;或将 Package 设为 Public(见第六节)

### 2.4 SSH 密钥(仅运维用,CI 不再使用)
- 本地 `~/.ssh/scinexus_ecs`(私钥)+ `scinexus_ecs.pub`(公钥已放到 ECS)
- 验证:`ssh -i ~/.ssh/scinexus_ecs root@47.76.152.223`

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
- `watchtower`:`--interval 60 --cleanup --label-enable`,只监控带标签的容器,更新后自动清旧镜像。

---

## 五、日常迭代流程

### 5.1 改代码后自动部署
```bash
git add -A && git commit -m "changes" && git push origin main
```
GitHub Actions 构建并推镜像(约 2~4 分钟);Watchtower 在 60s 轮询周期内发现更新,自动 pull + 重建。
**全程约 3~5 分钟线上生效,Actions 变绿不代表已上线,以 curl 验证为准。**

### 5.2 查看部署状态
- GitHub 仓库 → **Actions** 标签页 → 最新 workflow 是否绿(绿 = 镜像已推 GHCR)
- 线上验证(真正生效):`curl -s http://47.76.152.223/ | head -c 200` 或访问具体页面

### 5.3 ECS 端检查
```bash
ssh -i ~/.ssh/scinexus_ecs root@47.76.152.223
docker compose -f /opt/scinexus/docker-compose.yml ps                # web / watchtower 状态
docker logs scinexus-watchtower-1 --tail 20                          # Watchtower 轮询/更新记录
docker compose -f /opt/scinexus/docker-compose.yml logs --tail 50 web
curl -I http://127.0.0.1/                                           # 本地验证 200
```

### 5.4 回滚到上一个版本
```bash
cd /opt/scinexus
docker compose up -d --no-deps web ghcr.io/hakrin-dev/scinexus-frontend:<旧sha>
# 注意:Watchtower 会把它再升回 latest;回滚期间先停 watchtower:
# docker compose stop watchtower,回滚验证完再 docker compose start watchtower
```

---

## 六、后续扩展(规划中)

### 6.1 将 GHCR 镜像设为 Public(可选)
1. 访问 `https://github.com/users/Hakrin-dev/packages/container/package/scinexus-frontend`
2. **Package settings** → Change visibility → **Public**
3. 之后 ECS 拉取无需登录,GHCR_PAT 过期也不受影响

### 6.2 接入真实后端 + 数据库
在 `docker-compose.yml` 追加 service(api / postgres / redis 等);
不需要自动更新的服务**不要**加 watchtower 标签(已用 `--label-enable` 白名单机制)。
前端通过 `NEXT_PUBLIC_API_URL` 指向 api 服务。

### 6.3 HTTPS + 域名
- 加 nginx/caddy service 到 compose,443 已在安全组放行

---

## 七、常见问题

| 问题 | 处理 |
|---|---|
| Actions 失败,Login to GHCR 报错 | 检查 workflow 是否有 `permissions: packages: write`;GITHUB_TOKEN 自动注入无需配置 |
| Actions 绿但线上没更新 | `docker logs scinexus-watchtower-1` 看轮询是否报错(GHCR 凭证过期 → 重新 docker login);或镜像 digest 未变(确认 revision label 存在) |
| Watchtower 报 `client version too old` | 镜像要用 `ghcr.io/nicholas-fedor/watchtower`,containrrr 官方版已归档不兼容 Docker 29 |
| ECS `docker compose pull` 报 denied/not found | root 的 ghcr.io 登录失效 → 重新 `docker login`;或将 Package 设为 Public(6.1) |
| 构建失败 Module not found brand/... | 确认 `.dockerignore` **没有排除** `brand/logo-day.png` 与 `brand/logo-night.png` |
| 访问 http://IP 打不开 | 安全组 80 是否放行;`docker compose ps` 是否 healthy;`curl -I http://127.0.0.1/` 是否 200 |
