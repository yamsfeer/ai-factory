#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -f data/server.pid ] && kill -0 "$(cat data/server.pid)" 2>/dev/null; then
  kill "$(cat data/server.pid)" && echo "stopped $(cat data/server.pid)"
else
  echo "not running"
fi
rm -f data/server.pid
