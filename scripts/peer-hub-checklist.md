# Desktop / Laptop hub checklist (04901 fleet)

Pixel 10 field node ships GNSS to these hubs over **Tailscale**.

## Ports (Blueprint v5.0)

| Port | Bind | Purpose |
|------|------|---------|
| 2368/udp | 0.0.0.0 | GNSS ingest from Pixel |
| 8765/tcp | 0.0.0.0 | WebSocket UI bridge |
| 5173 or 5174/tcp | 0.0.0.0 | React / gods-eye UI |

## On each hub (desktop + laptop)

```bash
# Tailscale must be up and same tailnet as pixel-10
tailscale status

# Bridge must accept remote UDP (not 127.0.0.1 only)
# Example if using sovereign-engine bridge:
python3 ~/projects/sovereign-engine/bridge/telemetry_bridge.py
# or your existing gods-eye / district bridge on :8765 + :2368

# Confirm
ss -ulnp | grep 2368
ss -tlnp | grep 8765
```

## Expected fleet IPs (history)

| Host | Role | Tailscale |
|------|------|-----------|
| desktop | primary hub | 100.95.99.98 |
| laptop | secondary hub | 100.125.221.112 |
| penguin | storage | 100.76.55.82 |
| pixel-10 | field | *(assigned after login)* |

## After Pixel joins Tailscale

On Pixel:
```bash
bash /home/droid/sovereign-engine/scripts/join-fleet.sh
python3 /home/droid/pixel_rover.py
```

On desktop/laptop UI: device **`pixel-10`** should go **ONLINE**.

## If IPs changed

Edit Pixel fleet map:
`/home/droid/sovereign-engine/bridge/fleet.json`

Or override without edit:
```bash
export SOVEREIGN_HOST_DESKTOP_IP=100.x.x.x
export SOVEREIGN_HOST_LAPTOP_IP=100.x.x.x
```
