#!/usr/bin/env bash
# Full ops: ensure stack up → stress → auto-debug once → print data summary
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PY="${HOME}/sovereign_venv/bin/python"
[[ -x "$PY" ]] || PY=python3

echo "══ SOVEREIGN OPS RUN ══"
echo "Root: $ROOT"

if ! ss -tlnp 2>/dev/null | grep -q ':8765'; then
  echo "[*] Starting earth stack..."
  bash "$ROOT/start-earth.sh" --daemon --no-fetch
  sleep 6
else
  echo "[*] Stack already up (8765)"
fi

echo "[1/3] Auto-debugger (once)..."
"$PY" "$ROOT/ops/auto_debugger.py" --once || true

echo "[2/3] Stress suite (all functions)..."
"$PY" "$ROOT/ops/stress_suite.py" || true

echo "[3/3] Data summary..."
"$PY" "$ROOT/ops/data_collector.py" || true

echo ""
echo "Reports:"
echo "  $ROOT/data/ops/auto_debug_latest.json"
echo "  $ROOT/data/ops/stress.jsonl"
echo "  $ROOT/data/ops/"
echo "Dashboard: http://localhost:5173  → Ops tab"
echo "══ DONE ══"
