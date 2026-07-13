# 04901 Fleet Map — Desktop · Laptop · Pixel 10

**Blueprint:** [Sovereign Earth Engine Master Blueprint v5.0](https://docs.google.com/document/d/1X0hYMPzz40A6je6Staa1nSAbjuDyiPXr99ZggVY69mE/edit)  
**Fleet file:** `bridge/fleet.json`  
**This node:** **Pixel 10** (`pixel-10` / user `droid` / hostname `debian`)

---

## System topology (what we are building)

```
                    ┌──────────────────────────┐
                    │  Blueprint v5.0 (Drive)  │
                    │  GitHub keithdickey207   │
                    └────────────┬─────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
   ┌─────▼──────┐         ┌──────▼──────┐         ┌──────▼──────┐
   │  DESKTOP   │         │   LAPTOP    │         │  PIXEL 10   │
   │ 100.95.    │◄───────►│ 100.125.    │◄───────►│ (this node) │
   │ 99.98      │ Tailscale│ 221.112     │ Tailscale│ + local LAN │
   │ primary    │  mesh   │ secondary   │  mesh   │ field node  │
   │ hub        │         │ hub         │         │             │
   └─────┬──────┘         └──────┬──────┘         └──────┬──────┘
         │                       │                       │
         │   UDP 2368 GNSS  /  WS 8765  /  UI 5173-74    │
         └───────────────────────┴───────────────────────┘
                                 │
                          ┌──────▼──────┐
                          │  PENGUIN    │
                          │ 100.76.55.82│
                          │ storage/SSH │
                          └─────────────┘
```

### Blueprint ports (v5.0)

| Port | Role |
|------|------|
| **8765** | WebSocket UI ↔ bridge |
| **5173/5174** | React / gods-eye UI |
| **2368** | UDP GNSS (Pixel shipper) |
| 2370 | UDP RF |
| 2371 | UDP LWIR |
| 2372 | UDP defense |
| 11434 | Ollama |

---

## Host registry

| ID | Role | Tailscale IP | Notes |
|----|------|--------------|--------|
| **desktop** | primary_hub | `100.95.99.98` | gods-eye / live-node hub |
| **laptop** | secondary_hub | `100.125.221.112` | UI :5173 gods-eye |
| **penguin** | storage | `100.76.55.82` | photo rsync / SSH |
| **pixel-10** | field_node | *(join Tailscale)* | this handset — LAN `10.142.54.167` |

IPs recovered from operator shell history on this device. Override anytime:

```bash
export SOVEREIGN_HOST_DESKTOP_IP=100.x.x.x
export SOVEREIGN_HOST_LAPTOP_IP=100.x.x.x
```

---

## Pixel 10 link procedure

```bash
# 1) Join Tailscale mesh (one-time login)
sudo tailscale up --hostname=pixel-10 --accept-routes

# 2) Start local stack + fleet probe
bash /home/droid/sovereign-engine/scripts/join-fleet.sh

# 3) Ship live GPS to desktop + laptop (+ local UI)
python3 /home/droid/pixel_rover.py
```

**What `pixel_rover.py` does:** fan-out GNSS UDP to every hub in `fleet.json` **and** `127.0.0.1` so this phone’s UI stays live offline.

**What `mesh_link.py` does:** probes desktop/laptop/penguin (WS/UI/SSH), ships fleet heartbeats, writes `/tmp/sovereign_mesh_status.json` for the bridge/UI.

---

## Desktop / laptop checklist (already “set up” side)

On each workstation that already runs the stack:

1. **Tailscale online** (same tailnet as Pixel)
2. Bridge listening: **UDP 2368**, **WS 8765** on `0.0.0.0`
3. UI up on **5173** or **5174**
4. Firewall allows Tailscale interface for those ports
5. Optional: drop matching `fleet.json` under `~/projects/sovereign-engine/bridge/`

When Pixel ships, desktop/laptop device lists should show **`pixel-10` connected**.

---

## Local paths on this phone

| Path | Role |
|------|------|
| `/home/droid/sovereign-engine/` | Engine clone (git → GitHub) |
| `bridge/fleet.json` | Multi-host fleet map |
| `bridge/mesh_link.py` | Peer probe + heartbeats |
| `bridge/devices.json` | Device registry (fleet + sensors) |
| `bridge/telemetry_bridge.py` | Local UDP→WS bridge |
| `/home/droid/pixel_rover.py` | Multi-hub GNSS shipper |
| `/home/droid/live-node.sh` | Bring-up local services |
| `scripts/join-fleet.sh` | One-shot fleet join |
| `/home/droid/.grok/` | Grok agent (Drive/GitHub MCP) |

---

## Drive + GitHub (system plane)

| Plane | Content |
|-------|---------|
| **Drive blueprint** | Sovereign Earth Engine Master Blueprint Package v5.0 |
| **Drive Odyssey** | Memoir / narrative folder |
| **GitHub** | `sovereign-engine`, `sovereign-earth`, `dickey-sovereign-core`, `04901-*`, … |
| **Grok on Pixel** | MCP to Drive + GitHub while you operate the field node |

Full desktop stack from blueprint lives under `~/projects/` on desktop/laptop (`sovereign-earth`, `district_04901_grid`, Godot twin, etc.). This Pixel carries the **field + lightweight engine** slice and **joins** that mesh.

---

## Status commands

```bash
# Fleet probe once
python3 /home/droid/sovereign-engine/bridge/mesh_link.py --once

# Mesh status file
cat /tmp/sovereign_mesh_status.json | python3 -m json.tool

# Tailscale peers
tailscale status

# Local bridge devices over WS
python3 - <<'PY'
import asyncio, json, websockets
async def main():
    async with websockets.connect('ws://127.0.0.1:8765') as ws:
        print(await ws.recv())
asyncio.run(main())
PY
```

## Sync ledger (Drive · Grok · Gemini · GitHub)

Last full sync performed on this Pixel field node.

| Plane | Artifact | How it maps here |
|-------|----------|------------------|
| **Drive** | Master Blueprint Package v5.0 | Ports 8765/5173/2368–2372/11434, anchor 04901, five-layer architecture |
| **Drive** | Run comand | `~/start-sovereign.sh` / `--status` pattern |
| **Drive** | Gods-eye URL note | Hub COP :8787 / :5173 — hub-side; Pixel serves local UI :5173 |
| **Drive** | Odyssey memoir | Identity, Pixel as field node, coords 44.5520/-69.6317 |
| **Gemini** | `gemini-code-…py` Waterville Sovereignty API | Hub CVE vault API sketch — **not** installed on Pixel |
| **GitHub** | `keithdickey207/sovereign-engine` | This clone; React + bridge; `start-earth.sh` is for hubs |
| **GitHub** | `sovereign-earth` / `District_04901_Grid` | Full ISR + district bridge live on desktop/laptop |
| **Grok** | Prior Pixel sessions | Game engine on device, digital twin devices, fleet link to desktop/laptop |

### Pixel entrypoints

```bash
bash ~/start-sovereign.sh          # start / ensure up
bash ~/start-sovereign.sh --status # health check
bash ~/start-sovereign.sh --join   # fleet join + rover
bash ~/start-sovereign.sh --stop   # stop local stack
python3 ~/pixel_rover.py           # GNSS fan-out to hubs
```

### Blocker

**Tailscale is logged out** on this handset. Desktop (`100.95.99.98`) and laptop (`100.125.221.112`) stay unreachable until you authenticate with the same account as those machines.
