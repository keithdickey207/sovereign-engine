#!/usr/bin/env bash
# Stop Sovereign Earth Engine processes
ROOT="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$ROOT/.earth-pids"
if [[ -f "$PID_FILE" ]]; then
  while read -r pid; do
    kill "$pid" 2>/dev/null || true
  done < "$PID_FILE"
  rm -f "$PID_FILE"
fi
# best-effort cleanup of known listeners
for port in 5173 8765; do
  pid=$(ss -lntp 2>/dev/null | awk -v p=":$port" '$0 ~ p {if (match($0,/pid=[0-9]+/)) {print substr($0,RSTART+4,RLENGTH-4); exit}}')
  [[ -n "${pid:-}" ]] && kill "$pid" 2>/dev/null || true
done
echo "[+] earth stack stop requested"
