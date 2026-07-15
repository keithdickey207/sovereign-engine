#!/usr/bin/env python3
"""
Prefetch map tiles for offline/air-gap summit demo.
Caches to sovereign-engine/tile-cache/ served at /tiles/cache/

Keith Alan Dickey — WSDS / 04901 Studio
"""

from __future__ import annotations

import math
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "tile-cache"

# Maine 04901 + global overview
REGIONS = [
    {"name": "global", "lat": 20.0, "lon": 0.0, "zooms": (2, 4)},
    {"name": "maine", "lat": 44.552, "lon": -69.632, "zooms": (6, 10)},
    {"name": "waterville", "lat": 44.552, "lon": -69.632, "zooms": (11, 13)},
]

SOURCES = {
    "street": "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    "sat": "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
}


def lon_to_tile_x(lon: float, z: int) -> int:
    return int((lon + 180.0) / 360.0 * (2 ** z))


def lat_to_tile_y(lat: float, z: int) -> int:
    lat_r = math.radians(lat)
    return int((1.0 - math.log(math.tan(lat_r) + 1 / math.cos(lat_r)) / math.pi) / 2.0 * (2 ** z))


def tiles_for_region(lat: float, lon: float, z: int, radius: int = 2) -> list[tuple[int, int, int]]:
    cx = lon_to_tile_x(lon, z)
    cy = lat_to_tile_y(lat, z)
    out = []
    for dx in range(-radius, radius + 1):
        for dy in range(-radius, radius + 1):
            x = cx + dx
            y = cy + dy
            if 0 <= x < 2 ** z and 0 <= y < 2 ** z:
                out.append((z, x, y))
    return out


def fetch_tile(source: str, z: int, x: int, y: int) -> bool:
    dest = CACHE / source / str(z) / str(x) / f"{y}.png"
    if dest.exists() and dest.stat().st_size > 200:
        return True
    dest.parent.mkdir(parents=True, exist_ok=True)
    url = SOURCES[source].format(z=z, x=x, y=y)
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "SovereignEarth/1.0 (04901)"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = resp.read()
        if len(data) < 100:
            return False
        dest.write_bytes(data)
        return True
    except Exception as exc:
        print(f"  [!] {source} {z}/{x}/{y}: {exc}")
        return False


def main() -> int:
    sources = sys.argv[1:] if len(sys.argv) > 1 else ["street", "sat"]
    total = ok = 0
    print(f"[prefetch] Cache dir: {CACHE}")
    for region in REGIONS:
        zmin, zmax = region["zooms"]
        print(f"[prefetch] Region {region['name']} z{zmin}-{zmax}")
        for z in range(zmin, zmax + 1):
            radius = 3 if z <= 6 else 2 if z <= 10 else 1
            tiles = tiles_for_region(region["lat"], region["lon"], z, radius)
            for source in sources:
                for zt, xt, yt in tiles:
                    total += 1
                    if fetch_tile(source, zt, xt, yt):
                        ok += 1
                    time.sleep(0.05)
    print(f"[prefetch] Done: {ok}/{total} tiles cached")
    return 0 if ok > 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())