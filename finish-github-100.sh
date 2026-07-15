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

# Prefer the full license-github script
bash "$HOME/projects/sovereign-engine/license-github.sh" --push-only

# Also force-push remaining local commits if any
REPOS=(
  "$HOME/projects/sovereign-engine|keithdickey207/sovereign-engine"
  "$HOME/projects/sovereign-earth|keithdickey207/Sovereign-Earth-Engine-Platform"
  "$HOME/projects/district_04901_grid|keithdickey207/District_04901_Grid"
  "$HOME/projects/04901-sentinel|keithdickey207/04901-sentinel"
  "$HOME/projects/04901-digital-twin|keithdickey207/04901-digital-twin"
  "$HOME/projects/aether|keithdickey207/aether"
  "$HOME/open-source-galactic-flight-and-time-navigation-system-with-AI-|keithdickey207/open-source-galactic-flight-and-time-navigation-system-with-AI-"
  "$HOME/projects/sovereign-defense|keithdickey207/sovereign-defense"
  "$HOME/projects/sovereign-demographic-engine|keithdickey207/sovereign-demographic-engine"
  "$HOME/sovereign_narrative_engine|keithdickey207/sovereign-narrative-engine"
  "$HOME/sovereign_voice|keithdickey207/sovereign-voice"
  "$HOME/projects/sovereign-command-hub|keithdickey207/sovereign-command-hub"
  "$HOME/projects/tools/sovereign-sync|keithdickey207/sovereign-sync"
)

for entry in "${REPOS[@]}"; do
  IFS='|' read -r dir slug <<< "$entry"
  [[ -d "$dir" ]] || continue
  echo "=== $slug ==="
  cd "$dir"
  git init -b main 2>/dev/null || true
  git remote remove origin 2>/dev/null || true
  git remote add origin "https://github.com/${slug}.git"
  # ignore heavy junk
  if [[ ! -f .gitignore ]]; then
    printf 'node_modules/\n__pycache__/\n.venv/\ntile-cache/\n*.log\n.env\n' > .gitignore
  fi
  git add -A
  git reset HEAD -- node_modules tile-cache __pycache__ .venv venv 2>/dev/null || true
  if ! git diff --cached --quiet 2>/dev/null; then
    git commit -m "chore: complete stack sync — code + MIT (100%)" || true
  fi
  git branch -M main
  git push -u origin main --force-with-lease 2>&1 || git push -u origin main 2>&1 || echo "WARN: push failed for $slug"
  echo "  https://github.com/${slug}"
  echo "  LICENSE: https://github.com/${slug}/blob/main/LICENSE"
done

echo ""
echo "=============================================="
echo "  STACK GITHUB FINISH COMPLETE"
echo "=============================================="
