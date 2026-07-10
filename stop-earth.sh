#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$ROOT/.earth-pids"
if [ -f "$PID_FILE" ]; then
  while read -r pid; do
    kill "$pid" 2>/dev/null || true
  done < "$PID_FILE"
  rm -f "$PID_FILE"
fi
pkill -f "district_bridge.py" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
echo "Earth stack stopped"
