#!/bin/bash
# Sovereign live node — Pixel 10 field node (/home/droid)
set -euo pipefail

HOME_DIR="${HOME:-/home/droid}"
ENGINE="${SOVEREIGN_ENGINE:-$HOME_DIR/sovereign-engine}"
export SOVEREIGN_SELF_ID="${SOVEREIGN_SELF_ID:-pixel-10}"
LAN_IP="${SOVEREIGN_LAN_IP:-$(ip -4 -o addr show scope global 2>/dev/null | awk '{print $4}' | cut -d/ -f1 | grep -v '^100\.' | head -1 || true)}"
LAN_IP="${LAN_IP:-10.171.79.167}"
UI_PORT="${SOVEREIGN_UI_PORT:-5173}"
WS_PORT="${SOVEREIGN_WS_PORT:-8765}"
UDP_PORT="${SOVEREIGN_UDP_PORT:-2368}"

echo "============================================"
echo " SOVEREIGN LIVE NODE — Pixel 10 field"
echo "============================================"
echo "[*] Host: $(hostname)  User: $(whoami)  LAN: $LAN_IP"
echo "[*] Self-id: $SOVEREIGN_SELF_ID"
echo "[*] Engine: $ENGINE"
echo "[*] Fleet peers: desktop 100.95.99.98 | laptop 100.125.221.112 | penguin 100.76.55.82"

start_if_missing() {
  local pattern="$1"
  local cmd="$2"
  local log="$3"
  if ps -eo cmd | grep -F "$pattern" | grep -vq grep; then
    echo "[+] already: $pattern"
  else
    echo "[*] start: $pattern"
    nohup bash -c "$cmd" >"$log" 2>&1 &
    sleep 0.8
  fi
}

start_if_missing "bridge/telemetry_bridge.py" \
  "python3 $ENGINE/bridge/telemetry_bridge.py" \
  "$HOME_DIR/.sovereign-bridge.log"

start_if_missing "bridge/device_nodes.py" \
  "python3 $ENGINE/bridge/device_nodes.py" \
  "$HOME_DIR/.sovereign-nodes.log"

start_if_missing "sovereign-engine/react" \
  "cd $ENGINE/react && npm run dev -- --host 0.0.0.0 --port $UI_PORT" \
  "$HOME_DIR/.sovereign-ui.log"

# Hub/field heartbeat into local bridge
python3 - <<PY
import json, socket
s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
payload = {
    "device": "$SOVEREIGN_SELF_ID",
    "type": "gnss",
    "lat": 44.5520,
    "lon": -69.6317,
    "alt": 33.0,
    "sig": 1.0,
    "fleet": "04901-command",
    "src_host": "$SOVEREIGN_SELF_ID",
}
s.sendto(json.dumps(payload).encode(), ("127.0.0.1", $UDP_PORT))
print("[+] Local field heartbeat on UDP $UDP_PORT")
PY

# Optional: push heartbeat to known Tailscale hubs (best-effort)
python3 - <<'PY'
import json, socket
from pathlib import Path
fleet = json.loads(Path("/home/droid/sovereign-engine/bridge/fleet.json").read_text())
sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
payload = {
    "device": "pixel-10",
    "type": "gnss",
    "lat": 44.5520,
    "lon": -69.6317,
    "alt": 33.0,
    "sig": 0.4,
    "fleet": "04901-command",
    "role": "field_heartbeat",
    "src_host": "pixel-10",
}
msg = json.dumps(payload).encode()
for h in fleet.get("hosts", []):
    if h.get("role") not in ("primary_hub", "secondary_hub"):
        continue
    ip = h.get("tailscale_ip") or h.get("lan_ip")
    if not ip:
        continue
    port = int((h.get("ports") or {}).get("udp_gnss", 2368))
    try:
        sock.sendto(msg, (ip, port))
        print(f"[+] Fleet heartbeat -> {h['id']} {ip}:{port}")
    except OSError as e:
        print(f"[!] Fleet heartbeat fail {h['id']}: {e}")
PY

TS_IP=$(tailscale ip -4 2>/dev/null | head -1 || true)
echo "============================================"
echo " [+] PIXEL-10 NODE ONLINE (local)"
echo "     UI   http://$LAN_IP:$UI_PORT"
echo "     WS   ws://$LAN_IP:$WS_PORT"
echo "     UDP  $LAN_IP:$UDP_PORT"
echo "     TS   ${TS_IP:-not-joined}"
echo "     Map  $ENGINE/DEVICE_MAP.md"
echo "     Fleet $ENGINE/bridge/fleet.json"
echo "============================================"
