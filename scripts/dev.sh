#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -d venv ]]; then
  python3 -m venv venv
  source venv/bin/activate
  pip install -r bridge/requirements.txt
else
  source venv/bin/activate
fi

if [[ ! -d react/node_modules ]]; then
  (cd react && npm install)
fi

trap 'kill 0' EXIT

python bridge/telemetry_bridge.py &
(cd react && npm run dev) &

wait