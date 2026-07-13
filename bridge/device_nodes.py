#!/usr/bin/env python3
"""Continuous local sensor nodes for the Sovereign digital twin mesh."""

import argparse
import json
import math
import random
import socket
import time
from datetime import datetime, timezone
from pathlib import Path

ANCHOR_LAT = 44.5520
ANCHOR_LON = -69.6317
DEVICES_PATH = Path(__file__).with_name("devices.json")

LOCAL_NODES = {
    "gnss-01": {
        "type": "gnss",
        "interval": 2.0,
        "lat_offset": 0.0,
        "lon_offset": 0.0,
        "jitter_m": 3.0,
    },
    "lidar-01": {
        "type": "lidar",
        "interval": 0.5,
        "origin_x": 18.0,
        "origin_y": -12.0,
        "radius_m": 45.0,
    },
    "rf-01": {
        "type": "rf",
        "interval": 1.0,
        "origin_x": -22.0,
        "origin_y": 8.0,
        "radius_m": 35.0,
    },
}


def load_registry():
    with DEVICES_PATH.open() as f:
        data = json.load(f)
    return {d["id"]: d for d in data.get("devices", []) if d.get("host") == "local"}


def gnss_payload(device_id, cfg, t):
    jitter_deg = cfg["jitter_m"] / 111_000
    return {
        "device": device_id,
        "type": "gnss",
        "lat": ANCHOR_LAT + cfg["lat_offset"] + math.sin(t * 0.08) * jitter_deg,
        "lon": ANCHOR_LON + cfg["lon_offset"] + math.cos(t * 0.06) * jitter_deg,
        "alt": 85.0 + math.sin(t * 0.2) * 0.4,
        "sig": random.uniform(0.82, 0.98),
        "ts": datetime.now(timezone.utc).isoformat(),
    }


def local_xy_payload(device_id, cfg, t):
    angle = t * (0.7 if cfg["type"] == "lidar" else 0.45)
    radius = cfg["radius_m"] * (0.55 + 0.45 * abs(math.sin(t * 0.3)))
    return {
        "device": device_id,
        "type": cfg["type"],
        "x": cfg["origin_x"] + math.cos(angle) * radius,
        "y": cfg["origin_y"] + math.sin(angle) * radius,
        "sig": random.uniform(0.6, 0.95),
        "ts": datetime.now(timezone.utc).isoformat(),
    }


def build_payload(device_id, cfg, t):
    if cfg["type"] == "gnss":
        return gnss_payload(device_id, cfg, t)
    return local_xy_payload(device_id, cfg, t)


def main():
    parser = argparse.ArgumentParser(description="Sovereign local device mesh nodes")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=2368)
    args = parser.parse_args()

    registry = load_registry()
    nodes = {
        device_id: LOCAL_NODES[device_id]
        for device_id in registry
        if device_id in LOCAL_NODES
    }

    if not nodes:
        raise SystemExit("No local device nodes configured")

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    next_send = {device_id: 0.0 for device_id in nodes}
    start = time.monotonic()

    print(f"[*] Sovereign device mesh active ({len(nodes)} local nodes)")
    for device_id in sorted(nodes):
        print(f"    - {device_id} ({nodes[device_id]['type']})")

    while True:
        now = time.monotonic() - start
        for device_id, cfg in nodes.items():
            if now < next_send[device_id]:
                continue
            payload = build_payload(device_id, cfg, now)
            sock.sendto(json.dumps(payload).encode(), (args.host, args.port))
            next_send[device_id] = now + cfg["interval"]
        time.sleep(0.05)


if __name__ == "__main__":
    main()
