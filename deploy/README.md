# 深知 ShenZhi · 部署文档

> 架构:Docker Compose + GitHub Actions 自动构建部署到阿里云香港 ECS。
> 镜像仓库:阿里云 ACR 个人版(香港地域)。

---

## 一、架构总览

```
GitHub push (main)
   │
   ▼
GitHub Actions ──build 镜像──▶ ACR 香港 (registry.cn-hongkong...)
   │                               │
   └──── ssh ──▶ ECS ──docker compose pull──▶ 拉最新镜像并重启
                                        │
                                        ▼
                             http://47.238.241.77 (80 → web:3000)
```

| 组件 | 说明 |
|---|---|
| `web` | Next.js standalone server,监听 3000,compose 映射到宿主机 80 |
| ACR | 镜像存储(香港,命名空间 `hkr-shenzhi`,仓库 `shenzhi-frontend`) |
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

### 2.3 ACR
- 个人版(香港),用户名 `hakrin`,命名空间 `hkr-shenzhi`,仓库 `shenzhi-frontend`(私有)
- ECS 已 `docker login`(公网域名)✅

### 2.4 SSH 密钥
- 本地 `~/.ssh/shenzhi_ecs`(私钥)+ `shenzhi_ecs.pub`(公钥已放到 ECS)
- 验证:`ssh -i ~/.ssh/shenzhi_ecs root@47.238.241.77`

---

## 三、GitHub Secrets(必配)

仓库 **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | 值 |
|---|---|
| `ACR_USERNAME` | `hakrin` |
| `ACR_PASSWORD` | ACR Registry 登录密码(非阿里云账号密码) |
| `ECS_HOST` | `47.238.241.77` |
| `ECS_SSH_KEY` | 本地 `~/.ssh/shenzhi_ecs` 私钥**全部内容**(含 BEGIN/END 行) |

> 私钥查看:`cat ~/.ssh/shenzhi_ecs`(本地执行)。

---

## 四、ECS 上的部署目录(首次手动准备一次)

```bash
mkdir -p /opt/shenzhi && cd /opt/shenzhi
nano docker-compose.yml   # 粘贴下方内容
```

`docker-compose.yml`(与仓库根目录一致):

```yaml
services:
  web:
    image: registry.cn-hongkong.personal.cr.aliyuncs.com/hkr-shenzhi/shenzhi-frontend:latest
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

> 注意:该文件必须位于 `/opt/shenzhi/docker-compose.yml`,因为 GitHub Actions 部署脚本会 `cd /opt/shenzhi` 后执行 `docker compose pull/up`。

---

## 五、日常迭代流程

### 5.1 改代码后自动部署
```bash
git add -A && git commit -m "changes" && git push origin main
```
GitHub Actions 自动:构建 → 推 ACR → ssh 部署,约 2~3 分钟线上生效。

### 5.2 查看部署状态
- GitHub 仓库 → **Actions** 标签页 → 最新 workflow 是否绿
- ACR 控制台 → 镜像仓库 → `shenzhi-frontend` → 是否出现新 tag(`latest` + sha)

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
docker compose up -d --no-deps web registry.cn-hongkong.personal.cr.aliyuncs.com/hkr-shenzhi/shenzhi-frontend:<旧sha>
```

---

## 六、后续扩展(规划中)

### 6.1 接入真实后端 + 数据库
在 `docker-compose.yml` 追加 service:

```yaml
  api:
    image: registry.cn-hongkong.personal.cr.aliyuncs.com/hkr-shenzhi/shenzhi-api:latest
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

### 6.2 HTTPS + 域名
- 香港 ECS 绑域名免备案
- 加 nginx/caddy service 到 compose,443 已在安全组放行

---

## 七、常见问题

| 问题 | 处理 |
|---|---|
| Actions 失败,Login to ACR 报错 | 检查 `ACR_USERNAME`/`ACR_PASSWORD` 是否与 `docker login` 一致 |
| Actions 失败,Deploy on ECS 超时 | 检查 `ECS_HOST`/`ECS_SSH_KEY`;安全组 22 是否放行 |
| 构建失败 Module not found brand/... | 确认 `.dockerignore` **没有排除** `brand/logo-day.png` 与 `brand/logo-night.png` |
| `docker compose up -d --wait` 卡住 | 首次拉镜像慢;或健康检查失败,看 `docker compose ps` 和日志 |
| 访问 http://IP 打不开 | 安全组 80 是否放行;`docker compose ps` 是否 healthy;`curl -I http://127.0.0.1/` 是否 200 |