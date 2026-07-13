#!/usr/bin/env bash
# Pixel 10 field node entrypoint — 04901-command fleet
# Aligns with Drive "Run comand" pattern + Blueprint v5.0 + sovereign-engine repo
set -euo pipefail

HOME_DIR="${HOME:-/home/droid}"
ENGINE="${SOVEREIGN_ENGINE:-$HOME_DIR/sovereign-engine}"
export SOVEREIGN_SELF_ID="${SOVEREIGN_SELF_ID:-pixel-10}"
export SOVEREIGN_FLEET="${SOVEREIGN_FLEET:-$ENGINE/bridge/fleet.json}"

usage() {
  cat <<EOF
Usage: bash ~/start-sovereign.sh [--status|--join|--rover|--stop]

  (default)  Start local bridge + sensors + UI + mesh probe
  --status   Health check (ports, processes, fleet probe)
  --join     Full fleet join (Tailscale check + mesh + live-node)
  --rover    Start GPS shipper (pixel_rover.py) in background
  --stop     Stop local sovereign stack on this Pixel
EOF
}

status_check() {
  echo "============================================"
  echo " SOVEREIGN PIXEL STATUS — $SOVEREIGN_SELF_ID"
  echo "============================================"
  echo "Host: $(hostname)  User: $(whoami)"
  echo "LAN:  $(ip -4 -o addr show scope global 2>/dev/null | awk '{print $4}' | cut -d/ -f1 | grep -v '^100\.' | head -1 || echo '?')"
  TS=$(tailscale ip -4 2>/dev/null | head -1 || true)
  echo "TS:   ${TS:-NOT LOGGED IN}"
  echo
  echo "Processes:"
  ps -eo cmd | grep -E 'telemetry_bridge|device_nodes|mesh_link|pixel_rover|vite' | grep -v grep || echo "  (none)"
  echo
  echo "Ports:"
  ss -tulnp 2>/dev/null | grep -E '2368|8765|5173' || echo "  (none listening)"
  echo
  if [[ -f /tmp/sovereign_mesh_status.json ]]; then
    python3 -m json.tool /tmp/sovereign_mesh_status.json 2>/dev/null | head -60 || true
  fi
  python3 "$ENGINE/bridge/mesh_link.py" --once 2>/dev/null || true
}

stop_stack() {
  echo "[*] Stopping Pixel sovereign stack..."
  for pat in 'bridge/telemetry_bridge.py' 'bridge/device_nodes.py' 'bridge/mesh_link.py' 'pixel_rover.py'; do
    pgrep -f "$pat" 2>/dev/null | while read -r pid; do
      kill "$pid" 2>/dev/null || true
    done
  done
  pgrep -f 'sovereign-engine/react' 2>/dev/null | while read -r pid; do
    kill "$pid" 2>/dev/null || true
  done
  echo "[+] Stopped (best-effort)"
}

start_rover() {
  if pgrep -f 'pixel_rover.py' >/dev/null 2>&1; then
    echo "[+] pixel_rover already running"
  else
    nohup python3 "$HOME_DIR/pixel_rover.py" >"$HOME_DIR/.sovereign-rover.log" 2>&1 &
    echo "[+] pixel_rover started → $HOME_DIR/.sovereign-rover.log"
  fi
}

cmd="${1:-}"
case "$cmd" in
  -h|--help) usage; exit 0 ;;
  --status) status_check; exit 0 ;;
  --stop) stop_stack; exit 0 ;;
  --rover) start_rover; exit 0 ;;
  --join)
    bash "$ENGINE/scripts/join-fleet.sh"
    start_rover
    status_check
    exit 0
    ;;
  "")
    bash "$HOME_DIR/live-node.sh"
    if ! pgrep -f 'mesh_link.py' >/dev/null 2>&1; then
      nohup python3 "$ENGINE/bridge/mesh_link.py" --interval 15 \
        >"$HOME_DIR/.sovereign-mesh.log" 2>&1 &
      echo "[+] mesh_link started"
    fi
    start_rover
    status_check
    ;;
  *)
    usage
    exit 1
    ;;
esac
