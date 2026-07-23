/**
 * Sovereign OWN WIRE client — HTTP + SSE only.
 * No WebSocket. No foreign bus. Talks to sovereign_own_wire.py (stdlib).
 *
 * Keith Alan Dickey · WSDS / 04901 Studio · 7.2-own
 */

const DEFAULT_PORT = "8765";
const STORAGE_KEY = "sovereign_bridge_client_id";
const LAN_HUB = "192.168.18.8";
const POLL_MS = 1000;
const PING_MS = 10000;

function makeClientId() {
  try {
    const existing = sessionStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const id = `web_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
    sessionStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    return `web_${Math.random().toString(36).slice(2, 12)}`;
  }
}

/** Ordered HTTP base URLs for own wire (no ws://). */
function buildHttpBases(preferred) {
  const host = window.location.hostname || "localhost";
  const pagePort = window.location.port || "";
  const originPort = pagePort && pagePort !== "80" && pagePort !== "443" ? `:${pagePort}` : "";
  const isLocal = host === "localhost" || host === "127.0.0.1";
  // Crostini eth0 — ChromeOS Chrome can reach this; Dell LAN hub often offline
  const CROSTINI = "100.115.92.201";
  const TS_PEER = "100.95.99.98";
  const list = [];
  if (preferred) list.push(preferred.replace(/^ws/i, "http").replace(/\/$/, ""));
  // same-origin vite proxies (preferred when Earth is open on :5173)
  if (window.location.protocol.startsWith("http")) {
    list.push(`${window.location.protocol}//${host}${originPort}/own-wire`);
    list.push(`${window.location.protocol}//${host}:5173/own-wire`);
  }
  if (isLocal) {
    list.push(`http://127.0.0.1:${DEFAULT_PORT}`);
    list.push(`http://localhost:${DEFAULT_PORT}`);
  } else {
    // Same host as the page (Crostini IP or Tailscale peer IP)
    list.push(`${window.location.protocol}//${host}:${DEFAULT_PORT}`);
  }
  // Red laptop failover (live engines when Dell is offline)
  list.push(`http://${CROSTINI}:${DEFAULT_PORT}`);
  list.push(`http://${CROSTINI}:5173/own-wire`);
  list.push(`http://${CROSTINI}:48765`); // hub-gateway paint proxy
  list.push(`http://${TS_PEER}:${DEFAULT_PORT}`);
  list.push(`http://${TS_PEER}:5173/own-wire`);
  // Local LAN hub (desktop) — last; often offline away from desk
  list.push(`http://${LAN_HUB}:${DEFAULT_PORT}`);
  list.push(`http://${LAN_HUB}:5173/own-wire`);
  const seen = new Set();
  return list.filter((u) => {
    if (!u || seen.has(u)) return false;
    seen.add(u);
    return true;
  });
}

/** @deprecated name kept so imports still work — returns HTTP bases, not WS */
function buildUrlCandidates(preferred) {
  return buildHttpBases(preferred);
}

function defaultWsUrl() {
  return buildHttpBases()[0];
}

/**
 * Own-wire bridge client (HTTP poll + SSE). Same surface as old WS client.
 */
export function createBridgeSocket(opts = {}) {
  const bases = buildHttpBases(opts.url);
  let baseIndex = 0;
  const screen = opts.screen || "earth";
  const device = opts.device || "desktop";
  const channels = opts.channels || ["all"];
  const clientId = makeClientId();

  let alive = true;
  let attempt = 0;
  let connected = false;
  let connecting = false;
  let pollTimer = null;
  let pingTimer = null;
  let es = null;
  let lastMsgAt = 0;
  let rttMs = null;
  let lastPingSentAt = 0;
  const outbox = [];
  let bootDone = false;

  const log = (line) => {
    try { opts.onLog?.(line); } catch { /* */ }
  };

  const setState = (c, g) => {
    connected = c;
    connecting = g;
    try {
      opts.onState?.({
        connected: c,
        connecting: g,
        attempt,
        rttMs,
        url: bases[baseIndex % bases.length],
        quality: rttMs == null ? (c ? "good" : "offline") : rttMs < 80 ? "excellent" : "good",
        transport: "own_wire_http",
      });
    } catch { /* */ }
  };

  const deliver = (msg) => {
    if (!msg || typeof msg !== "object") return;
    lastMsgAt = Date.now();
    if (msg.type === "pong" || msg.type === "ping") {
      if (lastPingSentAt) rttMs = Math.max(0, Date.now() - lastPingSentAt);
      setState(true, false);
      return;
    }
    if (msg.type === "session_ack") {
      setState(true, false);
      log(`[OWN] session ${msg.client_id || clientId}`);
    }
    try { opts.onMessage?.(msg); } catch (e) {
      log(`[OWN] handler error: ${e?.message || e}`);
    }
  };

  const base = () => bases[baseIndex % bases.length];

  const fetchJson = async (path, init) => {
    const url = `${base()}${path.startsWith("/") ? path : `/${path}`}`;
    const res = await fetch(url, { cache: "no-store", ...init });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  };

  const postCmd = async (obj) => {
    try {
      const msg = await fetchJson("/api/cmd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(obj),
      });
      if (msg && typeof msg === "object") {
        if (Array.isArray(msg.messages)) msg.messages.forEach(deliver);
        else deliver(msg);
      }
      return true;
    } catch {
      return false;
    }
  };

  const pullBoot = async () => {
    try {
      const data = await fetchJson(`/api/boot?t=${Date.now()}`);
      const msgs = data.messages || data.boot || (Array.isArray(data) ? data : null);
      if (msgs && Array.isArray(msgs)) {
        msgs.forEach(deliver);
        bootDone = true;
        return true;
      }
      // single objects
      if (data.type) deliver(data);
      if (data.home_test_site) deliver(data.home_test_site);
      if (data.paint) deliver(data.paint.type ? data.paint : { ...data.paint, type: "location_paint" });
      return true;
    } catch {
      return false;
    }
  };

  const pullLive = async () => {
    try {
      const data = await fetchJson(`/api/live?t=${Date.now()}`);
      if (data.paint) {
        const p = data.paint;
        deliver(p.type ? p : { ...p, type: "location_paint" });
      }
      // Interior COP — unblocks Home "Acquiring live interior paint…"
      if (data.capability_scan) deliver(data.capability_scan);
      if (data.home_test_site) deliver(data.home_test_site);
      if (data.platform_status) deliver(data.platform_status);
      if (data.earth_neural) deliver(data.earth_neural);
      if (data.rf_entities) deliver(data.rf_entities);
      if (data.god_mode) deliver(data.god_mode);
      // Map layers from local own wire (not third-party APIs)
      if (data.satellite_tracks) deliver(data.satellite_tracks);
      if (data.global_defense_map) deliver(data.global_defense_map);
      if (data.air_defense) deliver(data.air_defense);
      if (data.airport_traffic) deliver(data.airport_traffic);
      // Photo live train — real-time image paint + stamped gallery
      if (data.photo_live) {
        const pl = data.photo_live;
        deliver(pl.type ? pl : { ...pl, type: "photo_live" });
      }
      // God's Eye knowledge stamps (wiki / stars / rhetoric watch)
      if (data.gods_eye_knowledge || data.knowledge) {
        const k = data.gods_eye_knowledge || data.knowledge;
        deliver(k.type ? k : { ...k, type: "gods_eye_knowledge" });
      }
      // Continuous live watch → actual judgment
      if (data.gods_eye_actual) {
        const a = data.gods_eye_actual;
        deliver(a.type ? a : { ...a, type: "gods_eye_actual" });
      }
      // Maritime / civic often only in messages — still deliver top-level if present
      if (data.maritime_tracks) deliver(data.maritime_tracks);
      if (data.global_civic_map) deliver(data.global_civic_map);
      if (data.messages) data.messages.forEach(deliver);
      if (data.earth_meta) deliver(data.earth_meta);
      setState(true, false);
      return true;
    } catch {
      return false;
    }
  };

  const openSse = () => {
    try {
      if (es) { try { es.close(); } catch { /* */ } }
      const url = `${base()}/api/stream`;
      es = new EventSource(url);
      es.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.messages) msg.messages.forEach(deliver);
          else deliver(msg);
          setState(true, false);
        } catch { /* */ }
      };
      es.onerror = () => { /* poll keeps us alive */ };
    } catch { /* */ }
  };

  const connect = async () => {
    if (!alive) return;
    setState(false, true);
    log(`[OWN] connect ${base()} attempt ${attempt + 1}`);
    let ok = false;
    for (let i = 0; i < bases.length; i++) {
      baseIndex = (baseIndex + i) % bases.length;
      try {
        const h = await fetchJson("/health");
        if (h && (h.status === "ok" || h.service || h.ok)) {
          ok = true;
          break;
        }
      } catch { /* next base */ }
    }
    if (!ok) {
      attempt += 1;
      setState(false, true);
      log("[OWN] no wire reachable — retry");
      if (alive) setTimeout(connect, Math.min(5000, 400 * attempt));
      return;
    }
    attempt = 0;
    setState(true, false);
    log(`[OWN] wire live · ${base()} · client ${clientId}`);
    await postCmd({
      type: "client_hello",
      client_id: clientId,
      device,
      screen,
      channels,
      bridge_client: "7.2-own-http",
      ts: Date.now(),
    });
    await pullBoot();
    await pullLive();
    openSse();
    // flush outbox
    while (outbox.length) {
      const m = outbox.shift();
      await postCmd(typeof m === "string" ? JSON.parse(m) : m);
    }
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(() => { if (alive) pullLive(); }, POLL_MS);
    if (pingTimer) clearInterval(pingTimer);
    pingTimer = setInterval(() => {
      lastPingSentAt = Date.now();
      postCmd({ type: "ping", client_id: clientId, t: lastPingSentAt, screen });
    }, PING_MS);
  };

  const send = (obj) => {
    const o = typeof obj === "string" ? (() => { try { return JSON.parse(obj); } catch { return { type: "raw", raw: obj }; } })() : obj;
    if (!connected) {
      if (outbox.length > 48) outbox.shift();
      outbox.push(o);
      return false;
    }
    postCmd(o);
    return true;
  };

  const destroy = () => {
    alive = false;
    if (pollTimer) clearInterval(pollTimer);
    if (pingTimer) clearInterval(pingTimer);
    try { es?.close(); } catch { /* */ }
    setState(false, false);
  };

  connect();

  return {
    send,
    destroy,
    connect,
    get clientId() { return clientId; },
    get connected() { return connected; },
    get connecting() { return connecting; },
    get readyState() { return connected ? 1 : 0; },
    get socket() { return null; },
    get rttMs() { return rttMs; },
    get url() { return base(); },
    get quality() { return connected ? "good" : "offline"; },
    get avgRtt() { return rttMs; },
    get transport() { return "own_wire_http"; },
  };
}

export default createBridgeSocket;
export { buildUrlCandidates, defaultWsUrl, buildHttpBases };
