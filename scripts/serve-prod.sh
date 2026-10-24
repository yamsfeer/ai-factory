#!/usr/bin/env bash
# 生产单实例：构建前端 → 起 Fastify（API + 静态资源）→ 自检
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PORT:-8891}"
HOST="${HOST:-127.0.0.1}"
DB_PATH="${DB_PATH:-data/app.db}"
PIDFILE="data/server.pid"
LOG="data/server.log"
mkdir -p data

if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
  kill "$(cat "$PIDFILE")" || true
  sleep 1
fi

npm run build >/dev/null

HOST="$HOST" PORT="$PORT" DB_PATH="$DB_PATH" nohup node --import tsx server/src/index.ts >> "$LOG" 2>&1 &
echo $! > "$PIDFILE"
sleep 2
code=$(curl --noproxy '*' -s -o /dev/null -w '%{http_code}' "http://${HOST}:${PORT}/api/health" || true)
echo "PID $(cat "$PIDFILE") → http://${HOST}:${PORT} (health ${code})"
