# ---- 构建 ----
FROM node:22-alpine AS builder
WORKDIR /app
# sharp 无预编译包时的源码编译兜底（pnpm-workspace.yaml 已 allowBuilds: sharp）
# dl-cdn.alpinelinux.org 在本网络下连接会静默冻结，改用阿里云镜像
RUN sed -i 's#dl-cdn.alpinelinux.org#mirrors.aliyun.com#g' /etc/apk/repositories \
    && apk add --no-cache python3 make g++ build-base
RUN corepack enable && corepack prepare pnpm@11.18.0 --activate \
    && pnpm config set registry https://registry.npmmirror.com
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# ---- 运行时 ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Docker 会把 HOSTNAME 设为容器 ID,Next standalone 会据此只绑定 eth0,
# 导致容器内 127.0.0.1 健康检查 connection refused;显式绑 0.0.0.0
ENV HOSTNAME=0.0.0.0
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# public/ 目前为空；后续添加静态资源时取消下一行注释
# COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
