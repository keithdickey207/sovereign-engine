#!/usr/bin/env bash
# Finish all Sovereign stack repos on GitHub (code + MIT license)
# Usage: bash ~/projects/sovereign-engine/finish-github-100.sh
set -euo pipefail

if ! gh auth status &>/dev/null; then
  echo "Logging into GitHub (browser or token)..."
  gh auth login
fi

echo "Authenticated:"
gh auth status
echo ""

bash "$HOME/projects/sovereign-engine/license-github.sh" --push-only
echo "STACK GITHUB FINISH COMPLETE"
