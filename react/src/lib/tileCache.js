import { tileUrl } from "./tileSources";

const memory = new Map();
const inflight = new Map();
const DB_NAME = "sovereign-earth-tiles";
const DB_STORE = "tiles";
const DB_VERSION = 1;

export const OFFLINE_MODE = import.meta.env.VITE_OFFLINE_MODE === "true";

let dbPromise = null;
let basemapStats = { ok: 0, fail: 0, lastError: "", lastOkAt: 0 };

export function getBasemapStats() {
  return { ...basemapStats, offline: OFFLINE_MODE, memory: memory.size };
}

function openDB() {
  if (dbPromise) return dbPromise;
  if (typeof indexedDB === "undefined") {
    dbPromise = Promise.resolve(null);
    return dbPromise;
  }
  dbPromise = new Promise((resolve) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
  return dbPromise;
}

async function idbGet(key) {
  const db = await openDB();
  if (!db) return null;
  return new Promise((resolve) => {
    const tx = db.transaction(DB_STORE, "readonly");
    const req = tx.objectStore(DB_STORE).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => resolve(null);
  });
}

async function idbPut(key, blob) {
  const db = await openDB();
  if (!db) return;
  return new Promise((resolve) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

const DISK_SOURCE = { satellite: "sat", hybrid: "sat", street: "street", local: "street", dark: "street" };

function cacheDiskUrl(source, z, x, y) {
  const disk = DISK_SOURCE[source] || source;
  return `/tiles/cache/${disk}/${z}/${x}/${y}.png`;
}

/** Reject Vite SPA HTML (200 + text/html) that used to poison the basemap. */
async function isRealImageBlob(blob) {
  if (!blob || blob.size < 200) return false;
  try {
    const head = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
    // JPEG
    if (head[0] === 0xff && head[1] === 0xd8) return true;
    // PNG
    if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) return true;
    // GIF
    if (head[0] === 0x47 && head[1] === 0x49 && head[2] === 0x46) return true;
    // WEBP (RIFF....WEBP)
    if (head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46) return true;
    return false;
  } catch {
    return false;
  }
}

function blobToImage(blob) {
  return new Promise((resolve) => {
    if (!blob) {
      resolve(null);
      return;
    }
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (img.naturalWidth > 0) resolve(img);
      else resolve(null);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

async function fetchImageBlob(url) {
  try {
    const resp = await fetch(url, { cache: "no-store" });
    if (!resp.ok) return null;
    const ct = (resp.headers.get("content-type") || "").toLowerCase();
    // Vite SPA fallback returns text/html with 200 for missing /tiles/cache/*
    if (ct.includes("text/html") || ct.includes("javascript") || ct.includes("json")) {
      return null;
    }
    const blob = await resp.blob();
    if (!(await isRealImageBlob(blob))) return null;
    return blob;
  } catch (err) {
    basemapStats.lastError = String(err?.message || err).slice(0, 80);
    return null;
  }
}

function markOk() {
  basemapStats.ok += 1;
  basemapStats.lastOkAt = Date.now();
}

function markFail(msg) {
  basemapStats.fail += 1;
  if (msg) basemapStats.lastError = String(msg).slice(0, 80);
}

/** Ordered fallbacks so the world map never stays black. */
function fallbackUrls(source, z, x, y) {
  const primary = tileUrl(source, z, x, y);
  const urls = [primary];
  // Live satellite family → dark → street
  if (source === "satellite" || source === "hybrid" || source === "clarity") {
    urls.push(tileUrl("dark", z, x, y));
    urls.push(tileUrl("street", z, x, y));
  } else if (source === "dark" || source === "topo" || source === "local") {
    urls.push(tileUrl("street", z, x, y));
    urls.push(tileUrl("satellite", z, x, y));
  } else if (source === "street") {
    urls.push(tileUrl("dark", z, x, y));
    urls.push(tileUrl("satellite", z, x, y));
  }
  // Prefetched local street tiles (when present)
  urls.push(cacheDiskUrl("street", z, x, y));
  // de-dupe
  return [...new Set(urls.filter(Boolean))];
}

function loadFromUrl(key, source, z, x, y) {
  if (inflight.has(key)) return inflight.get(key);

  const urls = fallbackUrls(source, z, x, y);
  const img = new Image();
  // Same-origin /tiles/* proxies: do NOT set crossOrigin (breaks some hops).
  try {
    const host = typeof window !== "undefined" ? window.location.host : "";
    const first = urls[0] || "";
    if (/^https?:\/\//i.test(first) && host && !first.includes(host)) {
      img.crossOrigin = "anonymous";
    }
  } catch { /* ignore */ }

  let urlIndex = 0;

  const promise = new Promise((resolve) => {
    const tryNext = () => {
      if (urlIndex >= urls.length) {
        memory.set(key, { img: null, ready: false, failed: true });
        inflight.delete(key);
        markFail("all tile urls failed");
        resolve(null);
        return;
      }
      const url = urls[urlIndex++];
      img.onload = async () => {
        if (!img.naturalWidth) {
          tryNext();
          return;
        }
        memory.set(key, { img, ready: true });
        inflight.delete(key);
        markOk();
        try {
          const blob = await fetchImageBlob(url);
          if (blob) await idbPut(key, blob);
        } catch { /* offline write ok */ }
        resolve(img);
      };
      img.onerror = () => {
        tryNext();
      };
      img.src = url;
    };
    tryNext();
  });

  inflight.set(key, promise);
  memory.set(key, { img, ready: false });
  return promise;
}

async function hydrateFromPersistent(key, source, z, x, y) {
  // 1) IndexedDB (only real image blobs)
  try {
    const idbBlob = await idbGet(key);
    if (idbBlob && (await isRealImageBlob(idbBlob))) {
      const img = await blobToImage(idbBlob);
      if (img) {
        memory.set(key, { img, ready: true });
        markOk();
        return img;
      }
    }
  } catch { /* cool */ }

  // 2) Disk cache (offline / prefetched street tiles) — never accept SPA HTML
  if (OFFLINE_MODE || source === "local" || source === "street") {
    try {
      const diskUrl = cacheDiskUrl(source === "local" ? "street" : source, z, x, y);
      const blob = await fetchImageBlob(diskUrl);
      if (blob) {
        const img = await blobToImage(blob);
        if (img) {
          memory.set(key, { img, ready: true });
          markOk();
          try { await idbPut(key, blob); } catch { /* cool */ }
          return img;
        }
      }
    } catch { /* cool */ }
  }

  if (OFFLINE_MODE) {
    // Last offline hope: any street disk tile
    try {
      const blob = await fetchImageBlob(cacheDiskUrl("street", z, x, y));
      if (blob) {
        const img = await blobToImage(blob);
        if (img) {
          memory.set(key, { img, ready: true });
          markOk();
          return img;
        }
      }
    } catch { /* cool */ }
    memory.set(key, { img: null, ready: false, failed: true });
    markFail("offline miss");
    return null;
  }

  // 3) Live network (primary path for Online mode)
  return loadFromUrl(key, source, z, x, y);
}

export function getTileImage(source, z, x, y) {
  // Guard bad coords (NaN / negative) so map never spins on broken URLs
  const zi = Math.max(0, Math.min(22, Math.floor(Number(z) || 0)));
  const xi = Math.floor(Number(x));
  const yi = Math.floor(Number(y));
  if (!Number.isFinite(xi) || !Number.isFinite(yi) || xi < 0 || yi < 0) {
    return { img: null, ready: false };
  }
  const max = 2 ** zi;
  if (xi >= max || yi >= max) return { img: null, ready: false };

  const key = `${source}/${zi}/${xi}/${yi}`;
  if (memory.has(key)) {
    const hit = memory.get(key);
    // Retry previously failed tiles after a while (network flap)
    if (hit?.failed && Date.now() - (hit.failAt || 0) > 15000) {
      memory.delete(key);
    } else {
      return hit;
    }
  }

  if (!inflight.has(key)) {
    // Seed a loading placeholder so callers never get undefined mid-hydrate
    memory.set(key, { img: null, ready: false });
    hydrateFromPersistent(key, source, zi, xi, yi).catch(() => {
      memory.set(key, { img: null, ready: false, failed: true, failAt: Date.now() });
      markFail("hydrate crash");
    });
  }
  return memory.get(key) || { img: null, ready: false };
}

export function pruneTileCache(max = 500) {
  if (memory.size <= max) return;
  const keys = [...memory.keys()];
  for (let i = 0; i < keys.length - max; i++) {
    memory.delete(keys[i]);
  }
}

export function clearTileMemory() {
  memory.clear();
  inflight.clear();
}

export function getOfflineStatus() {
  return { offline: OFFLINE_MODE, db: "indexeddb" };
}
