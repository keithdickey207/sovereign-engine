#!/usr/bin/env bash
# Field-node launcher for Pixel 10 (does NOT use desktop district_bridge paths).
# Desktop hubs should use start-earth.sh from this repo after full stack clone.
set -euo pipefail
exec bash "${HOME:-/home/droid}/start-sovereign.sh" "$@"
