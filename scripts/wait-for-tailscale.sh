#!/bin/bash
# Wait for Tailscale login, then join fleet and re-probe hubs.
set -euo pipefail
export SOVEREIGN_SELF_ID=pixel-10
ENGINE=/home/droid/sovereign-engine
LOG=/home/droid/.sovereign-ts-wait.log
echo "[$(date -Is)] waiting for Tailscale login..." | tee -a "$LOG"
for i in $(seq 1 120); do
  if tailscale status >/dev/null 2>&1 && tailscale ip -4 >/dev/null 2>&1; then
    TS=$(tailscale ip -4 | head -1)
    echo "[$(date -Is)] ONLINE ts=$TS" | tee -a "$LOG"
    # update fleet.json pixel-10 tailscale_ip
    python3 - <<PY
import json
from pathlib import Path
p = Path("$ENGINE/bridge/fleet.json")
data = json.loads(p.read_text())
for h in data.get("hosts", []):
    if h.get("id") == "pixel-10":
        h["tailscale_ip"] = "$TS"
p.write_text(json.dumps(data, indent=2) + "\n")
print("fleet.json updated with pixel-10 tailscale_ip=$TS")
PY
    # devices.json hub tip
    python3 - <<PY
import json
from pathlib import Path
p = Path("$ENGINE/bridge/devices.json")
data = json.loads(p.read_text())
if "hub" in data:
    data["hub"]["tailscale_ip"] = "$TS"
p.write_text(json.dumps(data, indent=2) + "\n")
PY
    bash "$ENGINE/scripts/join-fleet.sh" | tee -a "$LOG"
    python3 "$ENGINE/bridge/mesh_link.py" --once | tee -a "$LOG" || true
    echo "[$(date -Is)] fleet re-probe done" | tee -a "$LOG"
    exit 0
  fi
  sleep 5
done
echo "[$(date -Is)] timed out waiting for Tailscale (10 min)" | tee -a "$LOG"
exit 1
