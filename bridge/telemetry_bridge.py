#!/usr/bin/env python3
"""
Sovereign Telemetry Bridge
WSDS / 04901 Studio
Real-time UDP ingest → WebSocket broadcast
No cloud. No external APIs. Local only.
"""

import asyncio
import json
import math
import websockets
from datetime import datetime, timezone

ANCHOR_LAT = 44.5520
ANCHOR_LON = -69.6317
UDP_PORT = 2368
WS_HOST = "localhost"
WS_PORT = 8765
VALID_MODES = {"fusion", "gnss", "lidar", "rf"}

clients = set()
client_modes = {}
stats = {"points_ingested": 0, "packets_received": 0}


def latlon_to_local_xy(lat, lon):
    R = 6371000
    x = R * math.radians(lon - ANCHOR_LON) * math.cos(math.radians(ANCHOR_LAT))
    y = R * math.radians(lat - ANCHOR_LAT)
    return x, y * -1


def build_point(payload):
    if "x" in payload and "y" in payload:
        x, y = float(payload["x"]), float(payload["y"])
    elif "lat" in payload and "lon" in payload:
        x, y = latlon_to_local_xy(payload["lat"], payload["lon"])
    else:
        return None

    point_type = payload.get("type", "gnss")
    if point_type not in VALID_MODES - {"fusion"}:
        point_type = "gnss"

    return {
        "x": round(x, 2),
        "y": round(y, 2),
        "z": payload.get("alt", payload.get("z", 0)),
        "sig": payload.get("sig", 0.85),
        "type": point_type,
        "device": payload.get("device", "unknown"),
        "ts": datetime.now(timezone.utc).isoformat(),
    }


class TelemetryIngest(asyncio.DatagramProtocol):
    def datagram_received(self, data, addr):
        try:
            payload = json.loads(data.decode())
            point = build_point(payload)
            if not point:
                return

            stats["packets_received"] += 1
            stats["points_ingested"] += 1
            asyncio.create_task(broadcast_points([point]))
        except (json.JSONDecodeError, UnicodeDecodeError, TypeError, ValueError):
            pass


async def broadcast(message):
    if not clients:
        return
    await asyncio.gather(
        *[client.send(message) for client in list(clients)],
        return_exceptions=True,
    )


def filter_points_for_mode(points, mode):
    if mode == "fusion":
        return points
    return [p for p in points if p.get("type") == mode]


async def broadcast_points(points):
    if not points or not clients:
        return

    for client in list(clients):
        mode = client_modes.get(client, "fusion")
        filtered = filter_points_for_mode(points, mode)
        if filtered:
            try:
                await client.send(json.dumps(filtered))
            except websockets.exceptions.ConnectionClosed:
                pass


async def send_status(websocket):
    await websocket.send(
        json.dumps(
            {
                "event": "status",
                "anchor": {
                    "lat": ANCHOR_LAT,
                    "lon": ANCHOR_LON,
                    "label": "Waterville ME 04901",
                },
                "udp_port": UDP_PORT,
                "ws_port": WS_PORT,
                "clients": len(clients),
                "stats": stats,
            }
        )
    )


async def handle_command(websocket, message):
    cmd = message.get("cmd")
    if cmd == "set_mode":
        mode = message.get("mode", "fusion")
        if mode in VALID_MODES:
            client_modes[websocket] = mode
            await websocket.send(
                json.dumps({"event": "mode", "mode": mode, "ok": True})
            )
        else:
            await websocket.send(
                json.dumps({"event": "mode", "mode": mode, "ok": False})
            )
    elif cmd == "ping":
        await websocket.send(json.dumps({"event": "pong"}))
    elif cmd == "get_status":
        await send_status(websocket)


async def ws_handler(websocket):
    clients.add(websocket)
    client_modes[websocket] = "fusion"
    print(f"[+] Client connected ({len(clients)} total)")

    try:
        await send_status(websocket)
        async for raw in websocket:
            try:
                message = json.loads(raw)
                if isinstance(message, dict):
                    await handle_command(websocket, message)
            except json.JSONDecodeError:
                pass
    finally:
        clients.discard(websocket)
        client_modes.pop(websocket, None)
        print(f"[-] Client disconnected ({len(clients)} total)")


async def main():
    loop = asyncio.get_running_loop()
    await loop.create_datagram_endpoint(
        lambda: TelemetryIngest(),
        local_addr=("0.0.0.0", UDP_PORT),
    )
    print(f"[+] Sovereign UDP Ingest listening on 0.0.0.0:{UDP_PORT}")

    async with websockets.serve(ws_handler, WS_HOST, WS_PORT):
        print(f"[+] Sovereign WebSocket active on ws://{WS_HOST}:{WS_PORT}")
        await asyncio.Future()


if __name__ == "__main__":
    print("=== Sovereign Telemetry Bridge ===")
    print("Anchor: Waterville ME 04901")
    asyncio.run(main())