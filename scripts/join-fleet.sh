#!/bin/bash
# Join this Pixel 10 into the 04901 multi-host fleet (desktop + laptop + penguin).
set -euo pipefail

ENGINE="${SOVEREIGN_ENGINE:-/home/droid/sovereign-engine}"
FLEET="$ENGINE/bridge/fleet.json"
export SOVEREIGN_SELF_ID="${SOVEREIGN_SELF_ID:-pixel-10}"

echo "============================================"
echo " 04901 FLEET JOIN — Pixel 10 field node"
echo "============================================"
echo "[*] Self: $SOVEREIGN_SELF_ID"
echo "[*] Fleet: $FLEET"
echo "[*] Blueprint: Sovereign Earth Engine v5.0 (Drive)"

# 1) Tailscale — required path to desktop/laptop 100.x mesh
if ! command -v tailscale >/dev/null 2>&1; then
  echo "[!] tailscale not installed — install first (install.sh)"
  exit 1
fi

if ! tailscale status >/dev/null 2>&1; then
  echo "[*] Tailscale installed but not logged in."
  echo "    Run:  sudo tailscale up --hostname=pixel-10 --accept-routes"
  echo "    Then re-run this script."
  # still start local services
else
  echo "[+] Tailscale:"
  tailscale status | head -20 || true
  TS_IP=$(tailscale ip -4 2>/dev/null | head -1 || true)
  echo "[+] This node Tailscale IP: ${TS_IP:-unknown}"
fi

# 2) Local bridge + sensors + UI
bash /home/droid/live-node.sh

# 3) Mesh probe loop (background)
if ! ps -eo cmd | grep -q '[m]esh_link.py'; then
  echo "[*] Starting mesh_link probe..."
  nohup python3 "$ENGINE/bridge/mesh_link.py" --interval 15 \
    > /home/droid/.sovereign-mesh.log 2>&1 &
  echo "    log: /home/droid/.sovereign-mesh.log"
else
  echo "[+] mesh_link already running"
fi

# 4) One-shot probe report
echo "[*] Fleet probe:"
python3 "$ENGINE/bridge/mesh_link.py" --once || true

echo "============================================"
echo " NEXT ON DESKTOP / LAPTOP (if not already):"
echo "   1. Tailscale up and online"
echo "   2. Bridge listening UDP 2368 + WS 8765"
echo "   3. UI on :5173 or :5174"
echo " ON PIXEL:"
echo "   python3 /home/droid/pixel_rover.py"
echo "============================================"
