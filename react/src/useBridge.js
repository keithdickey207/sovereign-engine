import { useCallback, useEffect, useRef, useState } from "react";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8765";
const RECONNECT_MS = 2000;

export function useBridge(mode, addLog) {
  const [connected, setConnected] = useState(false);
  const [points, setPoints] = useState([]);
  const [bridgeStats, setBridgeStats] = useState(null);
  const [devices, setDevices] = useState({ total: 0, connected: 0, devices: [] });
  const [fleet, setFleet] = useState({ fleet_id: null, self_id: null, mesh: null });
  const wsRef = useRef(null);
  const modeRef = useRef(mode);
  const reconnectRef = useRef(null);

  modeRef.current = mode;

  const send = useCallback((payload) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;

      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        addLog("[NET] Connected to Sovereign Telemetry Bridge");
        ws.send(JSON.stringify({ cmd: "set_mode", mode: modeRef.current }));
        ws.send(JSON.stringify({ cmd: "get_status" }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (Array.isArray(data)) {
            setPoints((prev) => [...prev, ...data].slice(-600));
            return;
          }

          if (data.event === "status") {
            setBridgeStats(data.stats || null);
            if (data.devices) setDevices(data.devices);
            setFleet({
              fleet_id: data.fleet_id || null,
              self_id: data.self_id || null,
              mesh: data.mesh || null,
            });
            const mesh = data.mesh || {};
            addLog(
              `[BRIDGE] UDP:${data.udp_port} fleet:${data.fleet_id || "local"} peers:${mesh.peers_up ?? "?"}/${mesh.peers_total ?? "?"}`
            );
          } else if (data.event === "devices") {
            setDevices({
              total: data.total || 0,
              connected: data.connected || 0,
              devices: data.devices || [],
              fleet_id: data.fleet_id,
            });
          } else if (data.event === "mode" && data.ok) {
            addLog(`[MODE] Backend set to ${data.mode.toUpperCase()}`);
          } else if (data.event === "pong") {
            addLog("[NET] Bridge pong");
          }
        } catch (_) {}
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        addLog("[NET] Disconnected — reconnecting...");
        if (!cancelled) {
          reconnectRef.current = setTimeout(connect, RECONNECT_MS);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      cancelled = true;
      clearTimeout(reconnectRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [addLog]);

  useEffect(() => {
    send({ cmd: "set_mode", mode });
  }, [mode, send]);

  return { connected, points, bridgeStats, devices, fleet, send };
}
