# Sovereign VM Engine

Local-first spatial telemetry stack for the **04901 Spatial Core** — Waterville, ME.

UDP sensor ingest → Python WebSocket bridge → React canvas UI. No cloud. No external APIs.

## Architecture

```
Sensors / Simulator  --UDP:2368-->  telemetry_bridge.py  --WS:8765-->  React UI
```

| Layer | Path | Role |
|-------|------|------|
| Bridge | `bridge/telemetry_bridge.py` | Ingest UDP JSON, broadcast filtered points over WebSocket |
| Simulator | `bridge/simulator.py` | Generate demo GNSS / LiDAR / RF points |
| Frontend | `react/` | Sovereign VM canvas, mode controls, live telemetry HUD |

## Quick Start

**Requirements:** Node.js 20+, Python 3.11+

```bash
# One-command dev (bridge + Vite)
chmod +x scripts/dev.sh
./scripts/dev.sh
```

Or run separately:

```bash
# Terminal 1 — bridge
python3 -m venv venv && source venv/bin/activate
pip install -r bridge/requirements.txt
python bridge/telemetry_bridge.py

# Terminal 2 — frontend
cd react && npm install && npm run dev

# Terminal 3 — demo data (optional)
source venv/bin/activate
python bridge/simulator.py --count 100
```

Open **http://localhost:5173/**

## WebSocket Protocol

**Server → client (on connect):**
```json
{"event":"status","anchor":{"lat":44.552,"lon":-69.6317,"label":"Waterville ME 04901"},"udp_port":2368,"clients":1,"stats":{"points_ingested":0,"packets_received":0}}
```

**Server → client (telemetry):**
```json
[{"x":-7.92,"y":-11.12,"z":0,"sig":0.9,"type":"gnss","device":"test","ts":"..."}]
```

**Client → server:**
```json
{"cmd":"set_mode","mode":"fusion"}
{"cmd":"get_status"}
{"cmd":"ping"}
```

Modes: `fusion` (all sensors), `gnss`, `lidar`, `rf`.

## UDP Ingest (port 2368)

**GNSS (lat/lon):**
```json
{"lat":44.5521,"lon":-69.6318,"type":"gnss","sig":0.9,"device":"gps-01"}
```

**LiDAR / RF (local x,y meters from anchor):**
```json
{"x":42.5,"y":-18.3,"type":"lidar","sig":0.8,"device":"lidar-01"}
```

## Configuration

Copy `react/.env.example` to `react/.env` to override the WebSocket URL:

```
VITE_WS_URL=ws://localhost:8765
```

## License

MIT — see [LICENSE](LICENSE).

Copyright (c) 2026 Keith Alan Dickey — Waterville Software Development Services.