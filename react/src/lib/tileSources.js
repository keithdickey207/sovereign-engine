/** Tile URL templates — proxied via Vite for CORS + best live imagery
 *  Upgraded v6.2 — sat / clarity / dark / topo / street / local
 *  Keith Alan Dickey · WSDS / 04901 Studio
 */

export const TILE_SOURCES = {
  satellite: {
    label: "Live Satellite HD",
    /** Esri World Imagery — high-res global sat */
    url: (z, x, y) => `/tiles/sat/${z}/${y}/${x}`,
    maxZoom: 19,
    futuristic: true,
    kind: "sat",
  },
  hybrid: {
    label: "Sat + Labels",
    url: (z, x, y) => `/tiles/sat/${z}/${y}/${x}`,
    maxZoom: 19,
    labels: true,
    futuristic: true,
    kind: "sat",
  },
  clarity: {
    label: "Clarity (urban detail)",
    url: (z, x, y) => `/tiles/clarity/${z}/${y}/${x}`,
    maxZoom: 19,
    futuristic: true,
    kind: "sat",
  },
  dark: {
    label: "Tactical Dark",
    url: (z, x, y) => `/tiles/dark/${z}/${x}/${y}`,
    maxZoom: 19,
    futuristic: true,
    kind: "vector",
  },
  topo: {
    label: "Terrain / Topo",
    url: (z, x, y) => `/tiles/topo/${z}/${x}/${y}`,
    maxZoom: 17,
    kind: "topo",
  },
  street: {
    label: "OpenStreetMap",
    url: (z, x, y) => `/tiles/osm/${z}/${x}/${y}.png`,
    maxZoom: 19,
    kind: "street",
  },
  local: {
    label: "Local / Offline",
    // Prefetched cache under tile-cache/street (real 404s, never SPA HTML)
    url: (z, x, y) => `/tiles/cache/street/${z}/${x}/${y}.png`,
    maxZoom: 18,
    kind: "local",
  },
};

export function tileUrl(source, z, x, y) {
  const src = TILE_SOURCES[source] || TILE_SOURCES.satellite;
  return src.url(z, x, y);
}

export function isSatelliteSource(source) {
  const s = TILE_SOURCES[source];
  return s?.kind === "sat" || source === "satellite" || source === "hybrid" || source === "clarity";
}

export function listTileSources() {
  return Object.entries(TILE_SOURCES).map(([key, v]) => ({
    key,
    label: v.label,
    maxZoom: v.maxZoom,
    kind: v.kind,
  }));
}
