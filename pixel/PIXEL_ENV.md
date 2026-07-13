# Pixel 10 environment — synced

**Role:** field node `pixel-10` in fleet `04901-command`  
**Repo:** https://github.com/keithdickey207/sovereign-engine  
**Blueprint:** Drive Master Blueprint Package v5.0  

## Online now (local)

| Service | Port | Status |
|---------|------|--------|
| telemetry_bridge | UDP 2368 + WS 8765 | local |
| device_nodes (sim sensors) | → bridge | local |
| React UI | http://10.142.54.167:5173 | local |
| mesh_link | probes hubs | running |
| pixel_rover | GNSS fan-out | running |

## Needs you

1. **Tailscale login** (same account as desktop/laptop):  
   https://login.tailscale.com/a/1fe3ad3b017ca1  
2. After login, `wait-for-tailscale.sh` auto-updates fleet IPs and re-probes.

## Commands

```bash
bash ~/start-sovereign.sh
bash ~/start-sovereign.sh --status
bash ~/start-sovereign.sh --join
```
