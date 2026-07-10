#!/usr/bin/env bash
# Start Sovereign Earth Engine — bridge + React UI
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
BRIDGE="$HOME/projects/district_04901_grid/bridge/district_bridge.py"
EARTH_ROOT="$HOME/projects/sovereign-earth"
LOG_DIR="$ROOT/logs"
PID_FILE="$ROOT/.earth-pids"
if [ -x "$HOME/sovereign_venv/bin/python" ]; then
  PYTHON="$HOME/sovereign_venv/bin/python"
else
  PYTHON="python3"
fi
OFFLINE=0; PREFETCH=0; DAEMON=0; FETCH_DATA=1
for arg in "$@"; do
  case "$arg" in
    --offline) OFFLINE=1; FETCH_DATA=0 ;;
    --daemon) DAEMON=1 ;;
    --no-fetch) FETCH_DATA=0 ;;
    --prefetch) PREFETCH=1 ;;
  esac
done
mkdir -p "$LOG_DIR"
bash "$ROOT/stop-earth.sh" 2>/dev/null || true
sleep 1
echo "[1/2] Starting district bridge..."
export PYTHONUNBUFFERED=1
if [ "$DAEMON" -eq 1 ]; then
  nohup "$PYTHON" -u "$BRIDGE" >> "$LOG_DIR/bridge.log" 2>&1 &
else
  "$PYTHON" -u "$BRIDGE" &
fi
BRIDGE_PID=$!
sleep 2
echo "[2/2] Starting React UI..."
cd "$ROOT/react"
export VITE_OFFLINE_MODE="$OFFLINE"
if [ "$DAEMON" -eq 1 ]; then
  nohup npm run dev >> "$LOG_DIR/vite.log" 2>&1 &
  echo "$BRIDGE_PID" > "$PID_FILE"
  echo $! >> "$PID_FILE"
  echo "Dashboard: http://localhost:5173"
  exit 0
fi
echo "Dashboard: http://localhost:5173"
exec npm run dev
