#!/usr/bin/env bash
# License + push full Sovereign stack to GitHub (MIT)
# Keith Alan Dickey — WSDS / 04901 Studio
#
# Usage:
#   bash ~/projects/sovereign-engine/license-github.sh
#   bash ~/projects/sovereign-engine/license-github.sh --license-only
#   bash ~/projects/sovereign-engine/license-github.sh --push-only
#   bash ~/projects/sovereign-engine/license-github.sh --status

set -euo pipefail

PUSH_ONLY=false
LICENSE_ONLY=false
STATUS_ONLY=false
for arg in "$@"; do
  case "$arg" in
    --push-only) PUSH_ONLY=true ;;
    --license-only) LICENSE_ONLY=true ;;
    --status) STATUS_ONLY=true ;;
    -h|--help)
      echo "Usage: $0 [--license-only | --push-only | --status]"
      exit 0
      ;;
  esac
done

YEAR="$(date +%Y)"
GIT_USER_NAME="${GIT_USER_NAME:-Keith Dickey}"
GIT_USER_EMAIL="${GIT_USER_EMAIL:-keithdickey207@gmail.com}"

# folder|absolute_or_~/path|github_slug|visibility|copyright_holder
# path may be relative to $HOME if it starts with ~/
REPOS=(
  "sovereign-engine|~/projects/sovereign-engine|keithdickey207/sovereign-engine|public|WSDS"
  "sovereign-earth|~/projects/sovereign-earth|keithdickey207/Sovereign-Earth-Engine-Platform|public|WSDS"
  "district_04901_grid|~/projects/district_04901_grid|keithdickey207/District_04901_Grid|private|Keith"
  "04901-sentinel|~/projects/04901-sentinel|keithdickey207/04901-sentinel|public|Keith"
  "04901-digital-twin|~/projects/04901-digital-twin|keithdickey207/04901-digital-twin|public|Keith"
  "aether|~/projects/aether|keithdickey207/aether|public|Keith"
  "gns|~/open-source-galactic-flight-and-time-navigation-system-with-AI-|keithdickey207/open-source-galactic-flight-and-time-navigation-system-with-AI-|public|WSDS"
  "sovereign-defense|~/projects/sovereign-defense|keithdickey207/sovereign-defense|public|WSDS"
  "sovereign-demographic-engine|~/projects/sovereign-demographic-engine|keithdickey207/sovereign-demographic-engine|public|WSDS"
  "sovereign-narrative-engine|~/sovereign_narrative_engine|keithdickey207/sovereign-narrative-engine|public|WSDS"
  "sovereign-voice|~/sovereign_voice|keithdickey207/sovereign-voice|public|WSDS"
  "sovereign-command-hub|~/projects/sovereign-command-hub|keithdickey207/sovereign-command-hub|public|WSDS"
  "sovereign-sync|~/projects/tools/sovereign-sync|keithdickey207/sovereign-sync|public|WSDS"
)

expand_path() {
  local p="$1"
  p="${p/#\~/$HOME}"
  echo "$p"
}

write_license_wsds() {
  local dir="$1"
  cat > "${dir}/LICENSE" <<EOF
MIT License

Copyright (c) ${YEAR} Keith Alan Dickey
Waterville Software Development Services (WSDS) / 04901 Studio

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
EOF
}

write_license_keith() {
  local dir="$1"
  cat > "${dir}/LICENSE" <<EOF
MIT License

Copyright (c) ${YEAR} Keith Dickey

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
EOF
}

ensure_gitignore() {
  local dir="$1"
  local ignore="${dir}/.gitignore"
  if [[ -f "$ignore" ]]; then
    return 0
  fi
  cat > "$ignore" <<'EOF'
node_modules/
__pycache__/
*.py[cod]
.venv/
venv/
dist/
build/
.env
.env.*
*.log
.DS_Store
logs/
.earth-pids
cache/
tile-cache/
*.gguf
data/*.bsp
.idea/
.vscode/
EOF
}

ensure_git_repo() {
  local dir="$1"
  local remote="$2"
  cd "$dir"
  if [[ ! -d .git ]]; then
    git init -b main
  fi
  if ! git remote get-url origin &>/dev/null; then
    git remote add origin "https://github.com/${remote}.git"
  fi
  git config user.name "$GIT_USER_NAME"
  git config user.email "$GIT_USER_EMAIL"
}

check_github_auth() {
  if gh auth status &>/dev/null; then
    echo "[OK] GitHub CLI authenticated"
    return 0
  fi
  echo ""
  echo "GitHub is not logged in on this machine."
  echo "Run once:"
  echo "  gh auth login"
  echo "  # GitHub.com → HTTPS → Login with browser (or paste a PAT)"
  echo ""
  return 1
}

create_repo_if_missing() {
  local slug="$1"
  local visibility="$2"
  local desc="$3"
  if gh repo view "$slug" &>/dev/null; then
    echo "  [exists] https://github.com/${slug}"
    return 0
  fi
  echo "  [create] https://github.com/${slug}"
  if [[ "$visibility" == "public" ]]; then
    gh repo create "$slug" --public --description "$desc" --source . --remote origin --push=false 2>/dev/null \
      || gh repo create "$slug" --public --description "$desc"
  else
    gh repo create "$slug" --private --description "$desc" --source . --remote origin --push=false 2>/dev/null \
      || gh repo create "$slug" --private --description "$desc"
  fi
}

print_status() {
  echo "=============================================="
  echo "  SOVEREIGN STACK — LICENSE / GIT STATUS"
  echo "=============================================="
  printf "%-32s %-8s %-6s %-8s %s\n" "REPO" "LICENSE" "GIT" "REMOTE" "PATH"
  for entry in "${REPOS[@]}"; do
    IFS='|' read -r folder pathslug slug _vis _holder <<< "$entry"
    dir="$(expand_path "$pathslug")"
    lic="NO"; [[ -f "$dir/LICENSE" ]] && lic="YES"
    gitst="NO"; [[ -d "$dir/.git" ]] && gitst="YES"
    remote="—"; [[ -d "$dir/.git" ]] && remote="$(git -C "$dir" remote get-url origin 2>/dev/null || echo none)"
    exists="OK"; [[ -d "$dir" ]] || exists="MISSING"
    printf "%-32s %-8s %-6s %-8s %s\n" "$folder" "$lic" "$gitst" "$exists" "$dir"
    if [[ "$remote" != "—" ]]; then
      echo "    → $remote"
    fi
  done
}

if [[ "$STATUS_ONLY" == true ]]; then
  print_status
  exit 0
fi

echo "=============================================="
echo "  SOVEREIGN STACK — MIT LICENSE + GITHUB"
echo "=============================================="
echo ""

if [[ "$PUSH_ONLY" == false ]]; then
  echo "[1/3] Writing MIT LICENSE + .gitignore..."
  for entry in "${REPOS[@]}"; do
    IFS='|' read -r folder pathslug _slug _vis holder <<< "$entry"
    dir="$(expand_path "$pathslug")"
    if [[ ! -d "$dir" ]]; then
      echo "  [skip] missing ${dir}"
      continue
    fi
    if [[ "$holder" == "Keith" ]]; then
      write_license_keith "$dir"
    else
      write_license_wsds "$dir"
    fi
    ensure_gitignore "$dir"
    echo "  [license] ${folder}"
  done
  echo ""
fi

if [[ "$LICENSE_ONLY" == true ]]; then
  print_status
  echo ""
  echo "Done (--license-only). After gh auth login:"
  echo "  bash $0 --push-only"
  exit 0
fi

echo "[2/3] Preparing git repos..."
for entry in "${REPOS[@]}"; do
  IFS='|' read -r folder pathslug slug _vis _holder <<< "$entry"
  dir="$(expand_path "$pathslug")"
  [[ -d "$dir" ]] || continue
  ensure_git_repo "$dir" "$slug"
  echo "  [git] ${folder} → ${slug}"
done
echo ""

if ! check_github_auth; then
  print_status
  echo ""
  echo "License files are ready locally. After login:"
  echo "  bash $0 --push-only"
  exit 1
fi

echo "[3/3] Committing and pushing..."
for entry in "${REPOS[@]}"; do
  IFS='|' read -r folder pathslug slug visibility _holder <<< "$entry"
  dir="$(expand_path "$pathslug")"
  [[ -d "$dir" ]] || continue

  echo ""
  echo "--- ${folder} ---"
  cd "$dir"

  desc="Sovereign stack · ${folder} · MIT · WSDS / 04901 Studio"

  create_repo_if_missing "$slug" "$visibility" "$desc"

  # Avoid committing huge/local-only trees
  git add LICENSE README.md .gitignore SEE_STACK.md 2>/dev/null || true
  git add -A

  # Unstage common heavy paths if they snuck in
  git reset HEAD -- node_modules tile-cache __pycache__ .venv venv 2>/dev/null || true

  if git diff --cached --quiet 2>/dev/null; then
    echo "  [skip] nothing to commit"
  else
    git commit -m "chore: MIT license + Sovereign stack sync (${YEAR})

- Ensure LICENSE (MIT)
- Align with Sovereign Earth Engine / Command Hub
- Operator: Keith Alan Dickey — WSDS / 04901 Studio"
    echo "  [commit] $(git rev-parse --short HEAD)"
  fi

  # Ensure branch main
  git branch -M main 2>/dev/null || true
  if git push -u origin main 2>&1; then
    echo "  [pushed] https://github.com/${slug}"
    echo "  [license] https://github.com/${slug}/blob/main/LICENSE"
  else
    echo "  [warn] push failed for ${slug} — check auth / remote"
  fi
done

echo ""
echo "=============================================="
echo "  DONE — MIT licensed on GitHub"
echo "=============================================="
echo ""
print_status
echo ""
echo "Command Hub: bash ~/projects/sovereign-command-hub/start-hub.sh"
echo "Earth UI:    bash ~/projects/sovereign-engine/start-earth.sh"
