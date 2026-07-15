/** Layer control panel + legend for Earth Engine v6.1 */

const LAYER_DEFS = [
  { key: "satellites", label: "Satellites", color: "#66ccff", hint: "LEO/GEO ISR constellation" },
  { key: "military", label: "Military Map", color: "#ff6600", hint: "Bases, radar, SAM, chokepoints" },
  { key: "mesh", label: "Neural Mesh", color: "#aa88ff", hint: "Global synaptic backbone" },
  { key: "air", label: "Air Defense", color: "#ff4466", hint: "Aircraft, missiles, drones" },
  { key: "scans", label: "ISR Scans", color: "#00ff9d", hint: "Click-to-scan results" },
  { key: "night", label: "Day/Night", color: "#ffcc00", hint: "Solar terminator overlay" },
  { key: "maine", label: "Maine 207", color: "#00ff9d", hint: "04901 command zone" },
];

export function LayerPanel({ layers, onToggle }) {
  return (
    <div style={{ marginBottom: "8px" }}>
      <div style={{ color: "#66ccff", marginBottom: "4px", fontSize: "10px", letterSpacing: "1px" }}>
        MAP LAYERS
      </div>
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px",
        background: "#0a0a1a", border: "1px solid #2a2a5a", padding: "6px",
      }}>
        {LAYER_DEFS.map((l) => (
          <button
            key={l.key}
            onClick={() => onToggle(l.key)}
            title={l.hint}
            style={{
              padding: "5px 6px", textAlign: "left", cursor: "pointer",
              background: layers[l.key] ? "rgba(170,136,255,0.15)" : "#080810",
              border: `1px solid ${layers[l.key] ? l.color : "#1a1a2a"}`,
              color: layers[l.key] ? l.color : "#555",
              fontSize: "9px", fontFamily: "monospace",
            }}
          >
            {layers[l.key] ? "●" : "○"} {l.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function HelpPanel({ onClose }) {
  return (
    <div style={{
      background: "#0a0a1a", border: "1px solid #66ccff", padding: "10px",
      marginBottom: "8px", fontSize: "10px", lineHeight: "1.6", color: "#aaccee",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
        <span style={{ color: "#66ccff", fontWeight: "bold" }}>QUICK HELP</span>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#888", cursor: "pointer" }}>✕</button>
      </div>
      <div><b>Click</b> map → ISR human/animal scan</div>
      <div><b>Drag</b> → pan &nbsp; <b>Scroll</b> → zoom</div>
      <div><b>G</b> global &nbsp; <b>H</b> home 16 Kelsey &nbsp; <b>M</b> Maine 207 (same map)</div>
      <div><b>S</b> satellites &nbsp; <b>D</b> military map &nbsp; <b>L</b> mesh &nbsp; <b>A</b> air</div>
      <div><b>?</b> this help &nbsp; — use layer panel to toggle all overlays</div>
      <div style={{ marginTop: "4px", color: "#88aa88" }}>
        Satellites show live orbital tracks. Military layer shows global defense installations.
      </div>
    </div>
  );
}

export function SatelliteList({ tracks, overhead, onFlyTo }) {
  if (!tracks?.length) return null;
  return (
    <div style={{ marginBottom: "8px" }}>
      <div style={{ color: "#66ccff", fontSize: "10px" }}>
        SATELLITES ({tracks.length}) — {overhead} over 04901
      </div>
      <div style={{
        background: "#0a0a1a", border: "1px solid #2a2a5a", padding: "4px",
        maxHeight: "110px", overflowY: "auto", fontSize: "9px",
      }}>
        {tracks.map((s) => (
          <div
            key={s.sat_id}
            onClick={() => onFlyTo(s.lat, s.lon, 4)}
            style={{
              padding: "3px 4px", cursor: "pointer", marginBottom: "2px",
              borderLeft: `2px solid ${s.orbit_class === "GEO" ? "#ffaa00" : "#66ccff"}`,
              background: s.next_pass_04901_min < 15 ? "rgba(0,255,157,0.08)" : "transparent",
            }}
          >
            <span style={{ color: "#66ccff" }}>{s.name}</span>
            <span style={{ color: "#666" }}> — {s.orbit_class} {s.alt_km}km</span>
            <div style={{ color: "#888" }}>{s.mission}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export { LAYER_DEFS };