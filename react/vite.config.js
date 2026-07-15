import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TILE_CACHE_ROOT = path.resolve(__dirname, '../tile-cache')

/**
 * Serve prefetched tiles from sovereign-engine/tile-cache with real 404s
 * (never Vite SPA index.html — that was poisoning basemap image loads).
 */
function tileCacheMiddleware() {
  return {
    name: 'sovereign-tile-cache',
    configureServer(server) {
      const serve = (req, res, next) => {
        try {
          const raw = (req.url || '').split('?')[0]
          // Accept /tiles/cache/... and bare paths after mount
          let rel = raw.replace(/^\/tiles\/cache\/?/, '').replace(/^\/+/, '')
          if (!rel || rel.includes('..')) {
            res.statusCode = 404
            res.setHeader('Content-Type', 'text/plain')
            res.end('tile not found')
            return
          }
          const fp = path.normalize(path.join(TILE_CACHE_ROOT, rel))
          if (!fp.startsWith(TILE_CACHE_ROOT) || !fs.existsSync(fp) || !fs.statSync(fp).isFile()) {
            res.statusCode = 404
            res.setHeader('Content-Type', 'text/plain')
            res.end('tile not found')
            return
          }
          const ext = path.extname(fp).toLowerCase()
          const ctype =
            ext === '.jpg' || ext === '.jpeg'
              ? 'image/jpeg'
              : ext === '.webp'
                ? 'image/webp'
                : 'image/png'
          res.statusCode = 200
          res.setHeader('Content-Type', ctype)
          res.setHeader('Cache-Control', 'public, max-age=86400')
          fs.createReadStream(fp).pipe(res)
        } catch (err) {
          res.statusCode = 500
          res.end(String(err?.message || err))
        }
      }
      // Register before SPA fallback
      server.middlewares.use('/tiles/cache', serve)
    },
  }
}

/**
 * Earth UI + God's Eye PWA — full proxy mesh
 * - /bridge  → own wire (:8765)
 * - /tiles/* → live basemaps (CORS-safe)
 * - /tiles/cache → local prefetched tiles (real 404s)
 * - /gods-eye-api → defense node (:8787)
 *
 * Keith Alan Dickey · WSDS / 04901 Studio
 */
export default defineConfig({
  plugins: [react(), tileCacheMiddleware()],
  define: {
    'import.meta.env.VITE_OFFLINE_MODE': JSON.stringify('false'),
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    hmr: {
      clientPort: 5173,
    },
    proxy: {
      // ── District bridge WS + HTTP health ─────────────────────────
      // Finite proxyTimeout so a dead :8765 never freezes God's Eye on "Connecting…"
      '/bridge': {
        target: 'http://127.0.0.1:8765',
        ws: true,
        changeOrigin: true,
        secure: false,
        timeout: 10000,
        proxyTimeout: 10000,
        rewrite: (path) => {
          const next = path.replace(/^\/bridge/, '')
          return next && next.length ? next : '/'
        },
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.warn('[vite] /bridge proxy error:', err && err.message)
          })
          proxy.on('proxyReqWs', (_proxyReq, _req, socket) => {
            socket.setTimeout(10000)
            socket.on('error', (err) => {
              console.warn('[vite] /bridge ws socket:', err && err.message)
            })
          })
        },
      },
      // Some clients hit /ws
      '/ws': {
        target: 'http://127.0.0.1:8765',
        ws: true,
        changeOrigin: true,
        secure: false,
        timeout: 10000,
        proxyTimeout: 10000,
        rewrite: (path) => {
          const next = path.replace(/^\/ws/, '')
          return next && next.length ? next : '/'
        },
      },

      // ── God's Eye Defense Node (map + live) ─────────────────────
      '/gods-eye-api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/gods-eye-api/, ''),
      },

      // ── Own wire HTTP paint (primary path — no WebSocket) ───────
      '/location-paint': {
        target: 'http://127.0.0.1:8765',
        changeOrigin: true,
        rewrite: () => '/location_paint',
      },
      '/own-wire': {
        target: 'http://127.0.0.1:8765',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/own-wire/, '') || '/',
      },
      // Photo Live thumbs + stamped JPEGs (own wire static)
      '/photo-thumbs': {
        target: 'http://127.0.0.1:8765',
        changeOrigin: true,
      },
      '/photo-stamped': {
        target: 'http://127.0.0.1:8765',
        changeOrigin: true,
      },

      // ── Esri World Imagery (sat) — path is /tile/{z}/{y}/{x} ───
      '/tiles/sat': {
        target: 'https://server.arcgisonline.com',
        changeOrigin: true,
        rewrite: (path) =>
          path.replace(
            /^\/tiles\/sat\/(\d+)\/(\d+)\/(\d+)/,
            '/ArcGIS/rest/services/World_Imagery/MapServer/tile/$1/$2/$3',
          ),
      },
      // Esri Clarity
      '/tiles/clarity': {
        target: 'https://clarity.maptiles.arcgis.com',
        changeOrigin: true,
        rewrite: (path) =>
          path.replace(
            /^\/tiles\/clarity\/(\d+)\/(\d+)\/(\d+)/,
            '/arcgis/rest/services/World_Imagery/MapServer/tile/$1/$2/$3',
          ),
      },
      // Carto dark (tactical night map)
      '/tiles/dark': {
        target: 'https://basemaps.cartocdn.com',
        changeOrigin: true,
        rewrite: (path) =>
          path.replace(/^\/tiles\/dark\/(\d+)\/(\d+)\/(\d+)/, '/dark_all/$1/$2/$3.png'),
      },
      // OpenTopoMap
      '/tiles/topo': {
        target: 'https://tile.opentopomap.org',
        changeOrigin: true,
        rewrite: (path) =>
          path.replace(/^\/tiles\/topo\/(\d+)\/(\d+)\/(\d+)/, '/$1/$2/$3.png'),
      },
      // OSM street
      '/tiles/osm': {
        target: 'https://tile.openstreetmap.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/tiles\/osm/, ''),
      },
      // Local / offline = prefetched tile-cache (same middleware path)
      // Browser hits /tiles/local/z/x/y.png → rewritten to /tiles/cache/street/...
      // Handled by middleware via alias below is not needed if tileSources uses /tiles/cache.
    },
  },
})
