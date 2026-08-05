# 深知 ShenZhi · 部署文档

> 架构:Docker Compose + GitHub Actions 自动构建部署到阿里云香港 ECS。
> 镜像仓库:GitHub Container Registry(ghcr.io)。

---

## 一、架构总览

```
GitHub push (main)
   │
   ▼
GitHub Actions ──build 镜像──▶ GHCR (ghcr.io/hakrin-dev/shenzhi-frontend)
   │                               │
   └──── ssh ──▶ ECS ──docker compose pull──▶ 拉最新镜像并重启
                                        │
                                        ▼
                             http://47.238.241.77 (80 → web:3000)
```

| 组件 | 说明 |
|---|---|
| `web` | Next.js standalone server,监听 3000,compose 映射到宿主机 80 |
| GHCR | GitHub Container Registry,公有镜像免费无限量 |
| GitHub Actions | push 到 main 自动:构建 → 推镜像 → ssh 部署 |

---

## 二、一次性初始化(已完成 ✅)

### 2.1 ECS
- 地域:中国香港;镜像:Ubuntu 22.04 LTS;规格 2c4g + 2G swap
- 公网 IP:`47.238.241.77`
- 安全组入方向已放行:22 / 80 / 443

### 2.2 Docker + Compose(已在 ECS 装好)
```bash
docker --version          # Docker 29.7.1 ✅
docker compose version    # Compose v5.4.0 ✅
free -h                   # Swap 2.0G ✅
```

### 2.3 镜像仓库:GHCR(GitHub Container Registry)
- 镜像地址:`ghcr.io/hakrin-dev/shenzhi-frontend`
- 由 GitHub Actions 自动构建推送(GITHUB_TOKEN 免密),无需手动登录
- 仓库为公有,镜像默认私有 → **首次推送后需在 GitHub Packages 将镜像设为 Public**(见第六节)

### 2.4 SSH 密钥
- 本地 `~/.ssh/shenzhi_ecs`(私钥)+ `shenzhi_ecs.pub`(公钥已放到 ECS)
- 验证:`ssh -i ~/.ssh/shenzhi_ecs root@47.238.241.77`

---

## 三、GitHub Secrets(必配)

仓库 **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | 值 |
|---|---|
| `ECS_HOST` | `47.238.241.77` |
| `ECS_SSH_KEY` | 本地 `~/.ssh/shenzhi_ecs` 私钥**全部内容**(含 BEGIN/END 行) |

> 私钥查看:`cat ~/.ssh/shenzhi_ecs`(本地执行)。
> 
> **注意:GITHUB_TOKEN 由 GitHub 自动注入,无需配置;旧的 `ACR_USERNAME`/`ACR_PASSWORD` 两个 Secret 已不再需要,可在 Settings 中删除。**

---

## 四、ECS 上的部署目录

> **2026-08-05 起:无需手动放置 compose 文件。** GitHub Actions 的部署脚本会在每次部署时自动把下方内容写入 `/opt/shenzhi/docker-compose.yml`(仓库为唯一事实来源,ECS 上的旧 ACR 版文件会被自动覆盖)。

`docker-compose.yml`(与仓库根目录一致,由 CI 自动同步):

```yaml
services:
  web:
    image: ghcr.io/hakrin-dev/shenzhi-frontend:latest
    ports:
      - "80:3000"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:3000/"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 15s
```

> 注意:
> 1. 镜像必须已在 GitHub Packages 设为 Public,否则 ECS 拉取会报 `denied`/`not found`(见第六节)。

---

## 五、日常迭代流程

### 5.1 改代码后自动部署
```bash
git add -A && git commit -m "changes" && git push origin main
```
GitHub Actions 自动:构建 → 推 GHCR → ssh 部署,约 2~3 分钟线上生效。

### 5.2 查看部署状态
- GitHub 仓库 → **Actions** 标签页 → 最新 workflow 是否绿
- GitHub → 你的头像 → **Packages** → `shenzhi-frontend` → 是否出现新 tag(`latest` + sha)

### 5.3 ECS 端检查
```bash
ssh -i ~/.ssh/shenzhi_ecs root@47.238.241.77
docker compose -f /opt/shenzhi/docker-compose.yml ps      # web 应为 running (healthy)
docker compose -f /opt/shenzhi/docker-compose.yml logs --tail 50 web   # 看日志
curl -I http://127.0.0.1/                                  # 本地验证 200
```

### 5.4 回滚到上一个版本
```bash
cd /opt/shenzhi
docker compose up -d --no-deps web ghcr.io/hakrin-dev/shenzhi-frontend:<旧sha>
```

---

## 六、后续扩展(规划中)

### 6.1 将 GHCR 镜像设为 Public(首次推送后必须做一次)
1. GitHub → 右上角头像 → **Settings → Packages**,或直接访问 `https://github.com/users/Hakrin-dev/packages/container/package/shenzhi-frontend`
2. 点页面右侧 **Package settings**(或 Change visibility)
3. 选 **Public** → 确认 `shenzhi-frontend` 为 public
4. 之后 ECS 无需登录即可 `docker pull ghcr.io/hakrin-dev/shenzhi-frontend:latest`

### 6.2 接入真实后端 + 数据库
在 `docker-compose.yml` 追加 service:

```yaml
  api:
    image: ghcr.io/hakrin-dev/shenzhi-api:latest
    ports:
      - "8080:8080"
    env_file: .env
    depends_on:
      - postgres

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: shenzhi
      POSTGRES_PASSWORD: change-me
      POSTGRES_DB: shenzhi
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine

volumes:
  pgdata:
```
前端通过 `NEXT_PUBLIC_API_URL` 指向 api 服务。

### 6.3 HTTPS + 域名
- 香港 ECS 绑域名免备案
- 加 nginx/caddy service 到 compose,443 已在安全组放行

---

## 七、常见问题

| 问题 | 处理 |
|---|---|
| Actions 失败,Login to GHCR 报错 | 检查 workflow 是否有 `permissions: packages: write`;GITHUB_TOKEN 由系统自动注入无需配置 |
| Actions 失败,Deploy on ECS 超时 | 检查 `ECS_HOST`/`ECS_SSH_KEY`;安全组 22 是否放行 |
| ECS `docker compose pull` 报 denied/not found | 镜像尚未设为 Public → 见 6.1 节;或 ECS 上 compose 文件还是旧 ACR 地址 |
| 构建失败 Module not found brand/... | 确认 `.dockerignore` **没有排除** `brand/logo-day.png` 与 `brand/logo-night.png` |
| `docker compose up -d --wait` 卡住 | 首次拉镜像慢;或健康检查失败,看 `docker compose ps` 和日志 |
| 访问 http://IP 打不开 | 安全组 80 是否放行;`docker compose ps` 是否 healthy;`curl -I http://127.0.0.1/` 是否 200 |
