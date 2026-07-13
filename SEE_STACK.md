# SEE_STACK — Sovereign Engine

React global command dashboard + launchers.

## Hub machines (desktop / laptop)

- Stack index: `~/projects/SOVEREIGN_EARTH_ENGINE.md`
- Command hub: `bash ~/projects/sovereign-command-hub/start-hub.sh`
- Launch: `bash ~/projects/sovereign-engine/start-earth.sh`
- License: MIT

## Field node (this Pixel 10)

Do **not** use desktop `start-earth.sh` here (it expects `~/projects/district_04901_grid`). Use:

```bash
bash ~/start-sovereign.sh          # local bridge + UI + mesh + rover
bash ~/start-sovereign.sh --status
bash ~/start-sovereign.sh --join   # full fleet join
bash ~/start-sovereign.sh --rover  # GPS shipper only
bash ~/start-sovereign.sh --stop
```

| Source | What it feeds this node |
|--------|-------------------------|
| Drive Blueprint v5.0 | Ports, anchor 04901, architecture |
| GitHub `sovereign-engine` | Bridge + React UI |
| GitHub `sovereign-earth` | Core ISR (hub-side; not required on Pixel) |
| Grok sessions on device | Fleet map, mesh_link, pixel_rover |
| Gemini artifact | Waterville Sovereignty API sketch (hub R&D) |

**Tailscale hostname:** `pixel-10`  
**Fleet file:** `bridge/fleet.json`  
**Map:** `DEVICE_MAP.md`
