#!/usr/bin/env bash
# Start Sovereign Earth Engine — bridge + React UI (online by default)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
# DEFAULT: YOUR own wire (stdlib HTTP+SSE+SHM) — NO websockets package.
# Earth UI uses bridgeSocket.js → HTTP/SSE to this process.
# Emergency foreign WS bridge only if SOVEREIGN_USE_WS_BRIDGE=1
DISTRICT_ROOT="$HOME/projects/district_04901_grid"
if [[ "${SOVEREIGN_USE_WS_BRIDGE:-0}" == "1" ]]; then
  BRIDGE="$DISTRICT_ROOT/bridge/district_bridge.py"
  BRIDGE_LABEL="FOREIGN WS bridge (opt-in only)"
else
  BRIDGE="$DISTRICT_ROOT/bridge/sovereign_own_wire.py"
  BRIDGE_LABEL="OWN WIRE HTTP+SSE+SHM (no websockets pkg)"
  # Fall back if own-wire file is missing (older clones / partial sync)
  if [[ ! -f "$BRIDGE" ]]; then
    echo "[!] Missing $BRIDGE — falling back to district_bridge.py"
    BRIDGE="$DISTRICT_ROOT/bridge/district_bridge.py"
    BRIDGE_LABEL="FOREIGN WS bridge (auto-fallback)"
  fi
fi
EARTH_ROOT="$HOME/projects/sovereign-earth"
DEFENSE_ROOT="$HOME/projects/sovereign-defense"
GNS_ROOT="$HOME/open-source-galactic-flight-and-time-navigation-system-with-AI-"
LOG_DIR="$ROOT/logs"
PID_FILE="$ROOT/.earth-pids"
# Prefer sovereign_venv so bridge gets websockets and domain deps
if [ -x "$HOME/sovereign_venv/bin/python" ]; then
  PYTHON="$HOME/sovereign_venv/bin/python"
elif [ -x "$HOME/sovereign_venv/bin/python3" ]; then
  PYTHON="$HOME/sovereign_venv/bin/python3"
else
  PYTHON="python3"
fi
# Link all core projects so bridge can import defense + earth + district packages
export PYTHONPATH="${DISTRICT_ROOT}:${DEFENSE_ROOT}:${EARTH_ROOT}:${GNS_ROOT}:${PYTHONPATH:-}"
export PYTHONUNBUFFERED=1
# Main command node: Dell OptiPlex 3910 · Chrome OS Flex beta · penguin
if [[ -f "${HOME}/.config/sovereign/command-node.env" ]]; then
  # shellcheck disable=SC1091
  source "${HOME}/.config/sovereign/command-node.env"
fi
export SOVEREIGN_NODE_ID="${SOVEREIGN_NODE_ID:-04901_command}"
export SOVEREIGN_HOST_ID="${SOVEREIGN_HOST_ID:-dell-3910-flex}"
export SOVEREIGN_ROLE="${SOVEREIGN_ROLE:-main_command_node}"
export SOVEREIGN_COMMAND_NODE_PRIMARY=1
OFFLINE=0
PREFETCH=0
DAEMON=0
FETCH_DATA=1

for arg in "$@"; do
  case "$arg" in
    --offline) OFFLINE=1; FETCH_DATA=0 ;;
    --online)  OFFLINE=0; FETCH_DATA=1 ;;
    --prefetch) PREFETCH=1 ;;
    --daemon)  DAEMON=1 ;;
    --no-fetch) FETCH_DATA=0 ;;
  esac
done

mkdir -p "$LOG_DIR"

echo "=============================================="
echo "  SOVEREIGN EARTH ENGINE v5"
echo "  Global Defense & ISR — 04901 Command Anchor"
if [ "$OFFLINE" -eq 1 ]; then
  echo "  MODE: OFFLINE / AIR-GAP"
else
  echo "  MODE: ONLINE (live tiles + data)"
fi
echo "=============================================="
echo ""

if [ "$FETCH_DATA" -eq 1 ] && [ -f "$EARTH_ROOT/scripts/fetch_all_data.py" ]; then
  echo "[*] Refreshing live NRC + grid data..."
  "$PYTHON" "$EARTH_ROOT/scripts/fetch_all_data.py" >> "$LOG_DIR/fetch.log" 2>&1 &
fi

if [ "$OFFLINE" -eq 1 ]; then
  CACHE_DIR="$ROOT/tile-cache"
  if [ ! -d "$CACHE_DIR/street" ] && [ ! -d "$CACHE_DIR/sat" ]; then
    echo "[!] No tile cache. Run: $PYTHON $ROOT/scripts/prefetch_tiles.py"
    echo ""
  fi
fi

if [ "$PREFETCH" -eq 1 ]; then
  echo "[*] Prefetching offline map tiles..."
  "$PYTHON" "$ROOT/scripts/prefetch_tiles.py" street >> "$LOG_DIR/prefetch.log" 2>&1 &
  echo ""
fi

bash "$ROOT/stop-earth.sh" 2>/dev/null || true
sleep 1

echo "[1/2] Starting $BRIDGE_LABEL..."
echo "  Python: $PYTHON"
echo "  Module: $BRIDGE"
export PYTHONUNBUFFERED=1
if [ "$DAEMON" -eq 1 ]; then
  nohup "$PYTHON" -u "$BRIDGE" >> "$LOG_DIR/bridge.log" 2>&1 &
  BRIDGE_PID=$!
else
  "$PYTHON" -u "$BRIDGE" &
  BRIDGE_PID=$!
fi
sleep 2

if ! kill -0 "$BRIDGE_PID" 2>/dev/null; then
  echo "[!] Bridge failed. Check $LOG_DIR/bridge.log"
  exit 1
fi

echo "[2/2] Starting React UI..."
cd "$ROOT/react"
export VITE_OFFLINE_MODE="$OFFLINE"

if [ "$DAEMON" -eq 1 ]; then
  nohup npm run dev >> "$LOG_DIR/vite.log" 2>&1 &
  VITE_PID=$!
  echo "$BRIDGE_PID" > "$PID_FILE"
  echo "$VITE_PID" >> "$PID_FILE"
  sleep 3
  echo ""
  echo "  RUNNING (daemon) · $BRIDGE_LABEL"
  echo "  Dashboard:  http://localhost:5173"
  echo "  Own wire:   http://localhost:8765/location_paint"
  echo "  COP:        http://localhost:5173/gods-eye.html"
  echo "  Bridge:     $BRIDGE_PID  |  Vite: $VITE_PID"
  echo "  Logs:       $LOG_DIR/"
  echo "  Stop:       bash $ROOT/stop-earth.sh"
  exit 0
fi

echo ""
echo "  Dashboard:  http://localhost:5173"
echo "  Own wire:   http://localhost:8765/location_paint  ($BRIDGE_LABEL)"
echo "  Background: bash $ROOT/start-earth.sh --daemon"
echo "  Stop: Ctrl+C | bash $ROOT/stop-earth.sh"
echo ""

npm run dev -- --host &
