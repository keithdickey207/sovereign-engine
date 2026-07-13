#!/usr/bin/env python3
"""
Sovereign Fleet Mesh Link — 04901 multi-host interconnect.

Roles:
  - Probes desktop / laptop / penguin / field peers (Tailscale + LAN)
  - Ships local heartbeats + optional GNSS to every reachable hub UDP
  - Exposes a tiny status JSON for the bridge / UI
  - Does NOT require cloud; Tailscale is preferred transport

Blueprint ports (v5.0): WS 8765, UI 5173, UDP GNSS 2368 (+ 2370/2371/2372)
"""

from __future__ import annotations

import argparse
import json
import os
import socket
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

FLEET_PATH = Path(__file__).with_name("fleet.json")
STATUS_PATH = Path(os.environ.get("SOVEREIGN_MESH_STATUS", "/tmp/sovereign_mesh_status.json"))
SELF_ID = os.environ.get("SOVEREIGN_SELF_ID", "pixel-10")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def load_fleet() -> dict:
    with FLEET_PATH.open() as f:
        return json.load(f)


def resolve_targets(host: dict) -> list[str]:
    """Ordered candidate IPs for a host."""
    ips = []
    for key in ("tailscale_ip", "lan_ip"):
        val = host.get(key)
        if val:
            ips.append(val)
    # env overrides: SOVEREIGN_HOST_DESKTOP_IP etc.
    env_key = f"SOVEREIGN_HOST_{host['id'].upper().replace('-', '_')}_IP"
    env_ip = os.environ.get(env_key)
    if env_ip and env_ip not in ips:
        ips.insert(0, env_ip)
    return ips


def tcp_open(ip: str, port: int, timeout: float = 1.0) -> bool:
    try:
        with socket.create_connection((ip, port), timeout=timeout):
            return True
    except OSError:
        return False


def udp_ping(ip: str, port: int, payload: dict) -> bool:
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.settimeout(1.0)
        sock.sendto(json.dumps(payload).encode("utf-8"), (ip, port))
        sock.close()
        return True
    except OSError:
        return False


def probe_host(host: dict, blueprint_ports: dict) -> dict:
    ports = host.get("ports") or {}
    ui_port = int(ports.get("ui") or blueprint_ports.get("http_ui") or 5173)
    ws_port = int(ports.get("ws") or blueprint_ports.get("ws_ui") or 8765)
    udp_port = int(ports.get("udp_gnss") or blueprint_ports.get("udp_gnss") or 2368)
    ssh_port = int(ports.get("ssh") or 22)

    result = {
        "id": host["id"],
        "label": host.get("label", host["id"]),
        "role": host.get("role"),
        "reachable": False,
        "via": None,
        "services": {},
        "last_probe": now_iso(),
    }

    for ip in resolve_targets(host):
        svc = {
            "ip": ip,
            "ws": tcp_open(ip, ws_port, 0.8),
            "ui": tcp_open(ip, ui_port, 0.8),
            "ssh": tcp_open(ip, ssh_port, 0.8) if host.get("role") == "storage" or "ssh" in (host.get("services") or []) else False,
            "udp_shipped": False,
        }
        # Always try UDP ship of a fleet heartbeat (hubs ignore unknown shapes gracefully)
        hb = {
            "device": SELF_ID,
            "type": "gnss",
            "lat": 44.5520,
            "lon": -69.6317,
            "alt": 33.0,
            "sig": 0.5,
            "fleet": "04901-command",
            "role": "field_heartbeat",
            "src_host": SELF_ID,
            "ts": now_iso(),
        }
        if host.get("role") in ("primary_hub", "secondary_hub", "field_node") or "udp_gnss" in ports:
            svc["udp_shipped"] = udp_ping(ip, udp_port, hb)

        any_up = svc["ws"] or svc["ui"] or svc["ssh"] or svc["udp_shipped"]
        # Mark reachable if TCP service open; UDP is fire-and-forget so alone is weak signal
        if svc["ws"] or svc["ui"] or svc["ssh"]:
            result["reachable"] = True
            result["via"] = ip
            result["services"] = svc
            break
        # Keep last attempt info even if not fully reachable
        result["services"] = svc
        result["via"] = ip

    return result


def get_self_ips() -> dict:
    lan = None
    try:
        out = subprocess.check_output(
            ["bash", "-lc", "ip -4 -o addr show scope global | awk '{print $4}' | cut -d/ -f1"],
            text=True,
            timeout=3,
        )
        for line in out.splitlines():
            line = line.strip()
            if line and not line.startswith("100."):
                lan = line
                break
    except (subprocess.SubprocessError, FileNotFoundError):
        pass

    ts_ip = None
    try:
        out = subprocess.check_output(["tailscale", "ip", "-4"], text=True, timeout=3)
        ts_ip = out.strip().splitlines()[0] if out.strip() else None
    except (subprocess.SubprocessError, FileNotFoundError):
        pass

    return {"lan_ip": lan, "tailscale_ip": ts_ip}


def write_status(status: dict) -> None:
    STATUS_PATH.write_text(json.dumps(status, indent=2))


def run_loop(interval: float) -> None:
    fleet = load_fleet()
    bp_ports = fleet.get("blueprint", {}).get("ports", {})
    hosts = [h for h in fleet.get("hosts", []) if h["id"] != SELF_ID]

    print("=== Sovereign Fleet Mesh Link ===")
    print(f"[*] Self: {SELF_ID}")
    print(f"[*] Fleet: {fleet.get('fleet_id')}  hosts={len(fleet.get('hosts', []))}")
    print(f"[*] Status file: {STATUS_PATH}")
    print(f"[*] Blueprint: {fleet.get('blueprint', {}).get('version')} ports={bp_ports}")

    while True:
        self_ips = get_self_ips()
        peers = [probe_host(h, bp_ports) for h in hosts]
        up = sum(1 for p in peers if p["reachable"])
        status = {
            "event": "fleet_status",
            "fleet_id": fleet.get("fleet_id"),
            "self_id": SELF_ID,
            "self_ips": self_ips,
            "timestamp": now_iso(),
            "peers_up": up,
            "peers_total": len(peers),
            "peers": peers,
            "primary_hub": fleet.get("mesh_strategy", {}).get("primary_hub"),
            "blueprint_drive": fleet.get("blueprint", {}).get("drive_url"),
        }
        write_status(status)
        print(
            f"[{status['timestamp'][11:19]}] peers {up}/{len(peers)} "
            f"ts={self_ips.get('tailscale_ip') or '-'} lan={self_ips.get('lan_ip') or '-'}"
        )
        for p in peers:
            flag = "UP " if p["reachable"] else "down"
            via = p.get("via") or "-"
            svc = p.get("services") or {}
            bits = []
            if svc.get("ws"):
                bits.append("ws")
            if svc.get("ui"):
                bits.append("ui")
            if svc.get("ssh"):
                bits.append("ssh")
            if svc.get("udp_shipped"):
                bits.append("udp")
            print(f"    [{flag}] {p['id']:12} via={via:16} {','.join(bits) or 'no-svc'}")
        time.sleep(interval)


def run_once() -> int:
    fleet = load_fleet()
    bp_ports = fleet.get("blueprint", {}).get("ports", {})
    hosts = [h for h in fleet.get("hosts", []) if h["id"] != SELF_ID]
    self_ips = get_self_ips()
    peers = [probe_host(h, bp_ports) for h in hosts]
    status = {
        "event": "fleet_status",
        "fleet_id": fleet.get("fleet_id"),
        "self_id": SELF_ID,
        "self_ips": self_ips,
        "timestamp": now_iso(),
        "peers_up": sum(1 for p in peers if p["reachable"]),
        "peers_total": len(peers),
        "peers": peers,
        "primary_hub": fleet.get("mesh_strategy", {}).get("primary_hub"),
        "blueprint_drive": fleet.get("blueprint", {}).get("drive_url"),
    }
    write_status(status)
    print(json.dumps(status, indent=2))
    return 0 if status["peers_up"] > 0 else 2


def main():
    parser = argparse.ArgumentParser(description="Sovereign multi-host mesh link")
    parser.add_argument("--once", action="store_true", help="Single probe then exit")
    parser.add_argument(
        "--interval",
        type=float,
        default=float(os.environ.get("SOVEREIGN_MESH_INTERVAL", "15")),
        help="Loop interval seconds",
    )
    args = parser.parse_args()
    if args.once:
        raise SystemExit(run_once())
    run_loop(args.interval)


if __name__ == "__main__":
    main()
