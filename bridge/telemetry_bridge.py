#!/usr/bin/env python3
"""
Sovereign Telemetry Bridge v6.1
WSDS / 04901 Studio

Real-time UDP ingest → resilient WebSocket for Sovereign VM / side UIs.
Local only. No cloud. Sessions + heartbeat so screens stay linked.

Ports (standalone mode — do NOT run alongside district_bridge on same ports):
  UDP 2369  — GNSS telemetry (offset from district 2368 when coexisting)
  WS  8766  — Telemetry WebSocket (offset from district 8765)

When district_bridge is primary, prefer feeding it on UDP 2368 instead.
"""

from __future__ import annotations

import asyncio
import json
import math
import time
import uuid
from datetime import datetime, timezone

import websockets

ANCHOR_LAT = 44.5520
ANCHOR_LON = -69.6317

# session_id -> websocket
sessions: dict[str, object] = {}
by_ws: dict[object, str] = {}


def latlon_to_local_xy(lat: float, lon: float) -> tuple[float, float]:
    r = 6_371_000.0
    x = r * math.radians(lon - ANCHOR_LON) * math.cos(math.radians(ANCHOR_LAT))
    y = r * math.radians(lat - ANCHOR_LAT)
    return round(x, 2), round(-y, 2)


async def safe_broadcast(message: str) -> None:
    dead = []
    for sid, ws in list(sessions.items()):
        try:
            await ws.send(message)  # type: ignore[attr-defined]
        except Exception:
            dead.append(sid)
    for sid in dead:
        ws = sessions.pop(sid, None)
        if ws is not None:
            by_ws.pop(ws, None)


class TelemetryIngest(asyncio.DatagramProtocol):
    def datagram_received(self, data: bytes, addr) -> None:
        try:
            payload = json.loads(data.decode())
            if "lat" not in payload or "lon" not in payload:
                return
            x, y = latlon_to_local_xy(float(payload["lat"]), float(payload["lon"]))
            point = {
                "type": "telemetry_point",
                "x": x,
                "y": y,
                "lat": payload["lat"],
                "lon": payload["lon"],
                "z": payload.get("alt", 0),
                "sig": payload.get("sig", 0.85),
                "point_type": payload.get("type", "gnss"),
                "device": payload.get("device", "unknown"),
                "ts": datetime.now(timezone.utc).isoformat(),
                "engine": "telemetry_bridge_v6.1",
            }
            asyncio.create_task(safe_broadcast(json.dumps(point)))
        except Exception:
            pass


async def ws_handler(websocket) -> None:
    sid = f"tel_{uuid.uuid4().hex[:10]}"
    sessions[sid] = websocket
    by_ws[websocket] = sid
    print(f"[+] Telemetry client {sid} ({len(sessions)} total)")
    await websocket.send(json.dumps({
        "type": "telemetry_hello",
        "client_id": sid,
        "anchor": {"lat": ANCHOR_LAT, "lon": ANCHOR_LON},
        "bridge_version": "6.1-fast",
        "version": "6.1",
        "ts": time.time(),
    }))
    try:
        async for raw in websocket:
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue
            if msg.get("type") == "ping":
                await websocket.send(json.dumps({
                    "type": "pong",
                    "t": msg.get("t"),
                    "server_ts": time.time(),
                    "clients": len(sessions),
                }))
            elif msg.get("type") == "client_hello":
                # allow stable client_id from browser sessionStorage
                new_id = str(msg.get("client_id") or sid)
                if new_id != sid:
                    sessions.pop(sid, None)
                    sid = new_id
                    sessions[sid] = websocket
                    by_ws[websocket] = sid
                await websocket.send(json.dumps({
                    "type": "session_ack",
                    "client_id": sid,
                    "screen": msg.get("screen", "telemetry"),
                    "clients": len(sessions),
                }))
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        sid = by_ws.pop(websocket, None)
        if sid:
            sessions.pop(sid, None)
        print(f"[-] Telemetry client gone ({len(sessions)} total)")


async def heartbeat_loop() -> None:
    while True:
        await safe_broadcast(json.dumps({
            "type": "bridge_heartbeat",
            "engine": "telemetry_bridge",
            "clients": len(sessions),
            "ts": time.time(),
        }))
        await asyncio.sleep(15)


async def main(udp_port: int = 2369, ws_port: int = 8766) -> None:
    loop = asyncio.get_running_loop()
    await loop.create_datagram_endpoint(
        lambda: TelemetryIngest(),
        local_addr=("0.0.0.0", udp_port),
    )
    print(f"[+] Telemetry UDP ingest 0.0.0.0:{udp_port}")
    print(f"[+] Telemetry WS ws://0.0.0.0:{ws_port} (session+ping)")
    async with websockets.serve(
        ws_handler,
        "0.0.0.0",
        ws_port,
        ping_interval=20,
        ping_timeout=40,
        max_size=2 * 1024 * 1024,
    ):
        await heartbeat_loop()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("telemetry bridge stop")
