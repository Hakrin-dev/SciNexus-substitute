# ---- 构建 ----
FROM node:22-alpine AS builder
WORKDIR /app
# sharp 无预编译包时的源码编译兜底（pnpm-workspace.yaml 已 allowBuilds: sharp）
RUN apk add --no-cache python3 make g++ build-base
RUN corepack enable && corepack prepare pnpm@11.18.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# ---- 运行时 ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# public/ 目前为空；后续添加静态资源时取消下一行注释
# COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
