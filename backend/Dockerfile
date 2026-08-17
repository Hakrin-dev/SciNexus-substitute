# 研枢后端 FastAPI + 多智能体服务（Python 3.11）
# 构建：docker build -f backend/Dockerfile -t ghcr.io/hakrin-dev/scinexus-backend:latest .
FROM python:3.11-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# 系统依赖：curl 供 HEALTHCHECK / compose healthcheck 使用
# （libmagic1 当前代码未使用，不装；python-magic 不在 requirements 里）
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl \
    && rm -rf /var/lib/apt/lists/*

# 先装依赖层（层缓存优化）
COPY backend/server/requirements.txt /app/server/requirements.txt
COPY backend/agent/requirements.txt /app/agent/requirements.txt
RUN pip install --no-cache-dir -r /app/server/requirements.txt \
    && pip install --no-cache-dir -r /app/agent/requirements.txt

# 复制代码（注意：server/data 是 Python 包，含 mock_data.py 等模块，必须保留在镜像内；
# 数据产物 research.sqlite/pdfs/papers/embeddings.json 不入镜像，由 compose 挂载，
# 并通过 TOOL_DATA_DIR 环境变量指向挂载目录，见 docker-compose.yml）
COPY backend/server /app/server
COPY backend/agent /app/agent

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -f http://127.0.0.1:8000/api/health || exit 1

EXPOSE 8000
# 单 worker：agent 启动时会对 SQLite 做 DELETE+全量重写（store._upsert），
# 多 worker 并发写同一库会互锁导致 worker 启动失败、随机回退 mock。
CMD ["uvicorn", "server.main:app", "--host", "0.0.0.0", "--port", "8000"]
