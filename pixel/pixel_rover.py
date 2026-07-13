#!/usr/bin/env python3
"""
Sovereign GNSS shipper for Pixel 10.

Fans out UDP telemetry to every hub listed in fleet.json (desktop + laptop +
optional self). Prefer Tailscale IPs; fall back to LAN / env overrides.

  export SOVEREIGN_SELF_ID=pixel-10
  python3 pixel_rover.py
"""

from __future__ import annotations

import json
import os
import socket
import subprocess
import time
from pathlib import Path

FLEET_PATH = Path(
    os.environ.get(
        "SOVEREIGN_FLEET",
        "/home/droid/sovereign-engine/bridge/fleet.json",
    )
)
DEVICE_NAME = os.environ.get("SOVEREIGN_DEVICE_ID", "pixel-10")
UPDATE_RATE = float(os.environ.get("SOVEREIGN_UPDATE_HZ", "1.0"))
UDP_PORT = int(os.environ.get("SOVEREIGN_UDP_PORT", "2368"))


def load_hubs() -> list[tuple[str, str, int]]:
    """Return list of (host_id, ip, port)."""
    hubs: list[tuple[str, str, int]] = []
    try:
        fleet = json.loads(FLEET_PATH.read_text())
        port_default = int(
            fleet.get("blueprint", {}).get("ports", {}).get("udp_gnss", UDP_PORT)
        )
        for h in fleet.get("hosts", []):
            if h.get("role") not in ("primary_hub", "secondary_hub"):
                continue
            port = int((h.get("ports") or {}).get("udp_gnss", port_default))
            env_key = f"SOVEREIGN_HOST_{h['id'].upper().replace('-', '_')}_IP"
            candidates = []
            if os.environ.get(env_key):
                candidates.append(os.environ[env_key])
            if h.get("tailscale_ip"):
                candidates.append(h["tailscale_ip"])
            if h.get("lan_ip"):
                candidates.append(h["lan_ip"])
            for ip in candidates:
                hubs.append((h["id"], ip, port))
                break  # first candidate per host
    except (OSError, json.JSONDecodeError) as exc:
        print(f"[!] fleet load failed: {exc}")

    # Always include explicit env multi-target and local bridge
    extra = os.environ.get("SOVEREIGN_HUBS", "")
    for item in extra.split(","):
        item = item.strip()
        if not item:
            continue
        if ":" in item:
            ip, p = item.rsplit(":", 1)
            hubs.append(("env", ip, int(p)))
        else:
            hubs.append(("env", item, UDP_PORT))

    # Local bridge on this Pixel so UI sees self even offline from desktop
    hubs.append(("local", "127.0.0.1", UDP_PORT))

    # Dedupe by (ip, port)
    seen = set()
    unique = []
    for hid, ip, port in hubs:
        key = (ip, port)
        if key in seen:
            continue
        seen.add(key)
        unique.append((hid, ip, port))
    return unique


def get_location():
    try:
        result = subprocess.run(
            ["termux-location", "-p", "gps", "-r", "last"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        if result.returncode == 0 and result.stdout.strip():
            return json.loads(result.stdout)
    except Exception as e:
        print(f"[!] Sensor pull failed: {e}")
    return None


def main():
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    hubs = load_hubs()
    print(f"[*] Sovereign Rover [{DEVICE_NAME}] ACTIVE")
    print(f"[*] Fleet file: {FLEET_PATH}")
    for hid, ip, port in hubs:
        print(f"    -> hub={hid:10} {ip}:{port}")

    while True:
        hubs = load_hubs()  # hot-reload fleet / env
        loc = get_location()
        if loc and "latitude" in loc:
            accuracy = max(float(loc.get("accuracy", 10.0) or 10.0), 1.0)
            payload = {
                "device": DEVICE_NAME,
                "type": "gnss",
                "lat": loc["latitude"],
                "lon": loc["longitude"],
                "alt": loc.get("altitude", 0.0),
                "sig": max(0.1, min(1.0, 1.0 / accuracy)),
                "fleet": "04901-command",
                "src_host": DEVICE_NAME,
            }
            msg = json.dumps(payload).encode("utf-8")
            for hid, ip, port in hubs:
                try:
                    sock.sendto(msg, (ip, port))
                    print(
                        f"[+] TX {hid:10} {ip}:{port} | "
                        f"{payload['lat']:.5f},{payload['lon']:.5f}"
                    )
                except OSError as e:
                    print(f"[!] TX fail {hid} {ip}:{port} — {e}")
        else:
            # Keep hubs aware of the field node even without GPS lock
            hb = {
                "device": DEVICE_NAME,
                "type": "gnss",
                "lat": 44.5520,
                "lon": -69.6317,
                "alt": 33.0,
                "sig": 0.2,
                "fleet": "04901-command",
                "role": "field_heartbeat",
                "src_host": DEVICE_NAME,
            }
            msg = json.dumps(hb).encode("utf-8")
            for hid, ip, port in hubs:
                try:
                    sock.sendto(msg, (ip, port))
                except OSError:
                    pass
            print("[-] Waiting for GPS lock (heartbeat sent)")

        time.sleep(UPDATE_RATE)


if __name__ == "__main__":
    main()
