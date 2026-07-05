import { useState, useEffect, useRef, useCallback } from "react";
import { useBridge } from "./useBridge";

const W = 900;
const H = 600;
const GRID_CELL = 40;

function visiblePoints(points, mode) {
  if (mode === "fusion") return points;
  return points.filter((pt) => pt.type === mode);
}

export default function SovereignVMEngine() {
  const canvasRef = useRef();
  const [mode, setMode] = useState("fusion");
  const [running, setRunning] = useState(true);
  const [zoom, setZoom] = useState(1.0);
  const [fps, setFps] = useState(0);
  const [log, setLog] = useState([
    "[BOOT] Sovereign VM Engine initialized",
    "[VM] Waiting for telemetry bridge...",
    "[ANCHOR] Waterville ME 04901",
  ]);

  const camRef = useRef({ x: 0, y: 0, dragging: false, lastX: 0, lastY: 0 });
  const stateRef = useRef({ t: 0, frameCount: 0, lastFpsTime: performance.now() });

  const addLog = useCallback((msg) => {
    setLog((prev) => [...prev.slice(-50), `[${new Date().toISOString().slice(11, 19)}] ${msg}`]);
  }, []);

  const { connected, points, bridgeStats } = useBridge(mode, addLog);
  const filtered = visiblePoints(points, mode);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onDown = (e) => {
      camRef.current.dragging = true;
      camRef.current.lastX = e.clientX;
      camRef.current.lastY = e.clientY;
    };
    const onMove = (e) => {
      if (!camRef.current.dragging) return;
      camRef.current.x += e.clientX - camRef.current.lastX;
      camRef.current.y += e.clientY - camRef.current.lastY;
      camRef.current.lastX = e.clientX;
      camRef.current.lastY = e.clientY;
    };
    const onUp = () => {
      camRef.current.dragging = false;
    };

    canvas.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);

    return () => {
      canvas.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    let animId;

    const loop = () => {
      if (!running) {
        animId = requestAnimationFrame(loop);
        return;
      }

      const s = stateRef.current;
      s.t += 0.016;
      s.frameCount++;

      const now = performance.now();
      if (now - s.lastFpsTime >= 500) {
        setFps(Math.round(s.frameCount / ((now - s.lastFpsTime) / 1000)));
        s.frameCount = 0;
        s.lastFpsTime = now;
      }

      ctx.fillStyle = "#050a0f";
      ctx.fillRect(0, 0, W, H);

      ctx.strokeStyle = "rgba(0,180,120,0.12)";
      ctx.lineWidth = 0.5;
      for (let x = 0; x < W; x += GRID_CELL) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (let y = 0; y < H; y += GRID_CELL) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }

      const cx = W / 2 + camRef.current.x;
      const cy = H / 2 + camRef.current.y;

      ctx.strokeStyle = "rgba(0,255,160,0.3)";
      ctx.beginPath();
      ctx.moveTo(cx - 25, cy);
      ctx.lineTo(cx + 25, cy);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy - 25);
      ctx.lineTo(cx, cy + 25);
      ctx.stroke();

      for (const pt of filtered) {
        const sx = cx + (pt.x || 0) * zoom;
        const sy = cy + (pt.y || 0) * zoom;
        if (sx < 0 || sx > W || sy < 0 || sy > H) continue;

        let color = "rgba(255,255,255,0.6)";
        let radius = 2;

        if (pt.type === "gnss") {
          color = `rgba(80,180,255,${0.6 + (pt.sig || 0.5) * 0.4})`;
          radius = 2.8;
        } else if (pt.type === "lidar") {
          const g = Math.floor(160 + (pt.sig || 0.5) * 80);
          color = `rgba(0,${g},90,0.7)`;
          radius = 1.8;
        } else if (pt.type === "rf") {
          const r = Math.floor((pt.sig || 0.5) * 200);
          color = `rgba(${r},80,180,0.75)`;
          radius = 2.2;
        }

        ctx.beginPath();
        ctx.arc(sx, sy, radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      }

      const pulse = 16 + Math.sin(s.t * 3) * 5;
      ctx.beginPath();
      ctx.arc(cx, cy, pulse, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(0,255,160,0.35)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#00ffa0";
      ctx.fill();

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [running, zoom, filtered]);

  return (
    <div style={{ background: "#030d08", minHeight: "100vh", padding: "20px", color: "#00ffa0", fontFamily: "monospace" }}>
      <div style={{ textAlign: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 11, letterSpacing: 4, color: "#1a5a38" }}>WATERVILLE SOFTWARE DEVELOPMENT SERVICES</div>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: 2 }}>SOVEREIGN VM ENGINE</div>
        <div style={{ fontSize: 10, color: "#0a4028", letterSpacing: 3 }}>04901 SPATIAL CORE — LIVE TELEMETRY</div>
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 10, flexWrap: "wrap" }}>
        {["fusion", "gnss", "lidar", "rf"].map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{
              background: mode === m ? "#00ffa0" : "transparent",
              color: mode === m ? "#050a0f" : "#00ffa0",
              border: "1px solid #00ffa0",
              padding: "4px 14px",
              cursor: "pointer",
              fontSize: 11,
            }}
          >
            {m.toUpperCase()}
          </button>
        ))}

        <button onClick={() => setZoom((z) => Math.max(0.3, z - 0.2))} style={{ border: "1px solid #00ffa0", background: "transparent", color: "#00ffa0", width: 28 }}>-</button>
        <span style={{ width: 50, textAlign: "center" }}>{zoom.toFixed(1)}×</span>
        <button onClick={() => setZoom((z) => Math.min(4, z + 0.2))} style={{ border: "1px solid #00ffa0", background: "transparent", color: "#00ffa0", width: 28 }}>+</button>

        <button
          onClick={() => setRunning((r) => !r)}
          style={{
            marginLeft: 12,
            background: running ? "transparent" : "#00ffa020",
            color: running ? "#ff5555" : "#00ffa0",
            border: `1px solid ${running ? "#ff5555" : "#00ffa0"}`,
            padding: "4px 16px",
          }}
        >
          {running ? "HALT" : "RUN"}
        </button>
      </div>

      <div style={{ position: "relative", width: W, margin: "0 auto" }}>
        <canvas ref={canvasRef} width={W} height={H} style={{ border: "1px solid #0a3a22", background: "#050a0f", cursor: "crosshair" }} />

        <div style={{ position: "absolute", top: 12, left: 12, background: "rgba(2,14,10,0.9)", border: "1px solid #0a3a22", padding: "8px 12px", fontSize: 11 }}>
          <div style={{ color: "#00ffa0", marginBottom: 6, borderBottom: "1px solid #0a3a22", paddingBottom: 4 }}>SOVEREIGN VM — 04901</div>
          <div>BRIDGE: {connected ? "CONNECTED" : "OFFLINE"}</div>
          <div>MODE: {mode.toUpperCase()}</div>
          <div>FPS: {fps}</div>
          <div>POINTS: {filtered.length} / {points.length}</div>
          <div>ZOOM: {zoom.toFixed(1)}×</div>
          {bridgeStats && <div>INGEST: {bridgeStats.points_ingested}</div>}
          <div style={{ marginTop: 6, fontSize: 9, color: "#0a4a28" }}>ANCHOR: WATERVILLE ME 04901</div>
        </div>

        <div style={{ position: "absolute", bottom: 12, left: 12, right: 12, maxHeight: 80, overflowY: "auto", background: "rgba(2,10,6,0.9)", border: "1px solid #0a3a22", padding: "6px 10px", fontSize: 10 }}>
          {log.slice(-12).map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      </div>

      <div style={{ textAlign: "center", marginTop: 10, fontSize: 10, color: "#0a3a22" }}>DRAG TO PAN • +/- TO ZOOM • HALT TO FREEZE</div>
    </div>
  );
}