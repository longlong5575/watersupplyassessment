#!/usr/bin/env bash
set -euo pipefail

AGENT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$AGENT_ROOT/backend"
FRONT="$AGENT_ROOT/frontend/front"
MOBILE="$AGENT_ROOT/frontend/front-mobile"
LOG="$AGENT_ROOT/startup-mac.log"

BACKEND_PID=""
FRONT_PID=""
MOBILE_PID=""

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" | tee -a "$LOG"
}

install_frontend_deps() {
  npm install --package-lock=false
}

run_frontend_dev() {
  npm run dev:local
}

cleanup() {
  log "Stopping local services..."
  for pid in "$MOBILE_PID" "$FRONT_PID" "$BACKEND_PID"; do
    if [[ -n "${pid:-}" ]] && kill -0 "$pid" >/dev/null 2>&1; then
      kill "$pid" >/dev/null 2>&1 || true
    fi
  done
}

wait_for_url() {
  local url="$1"
  for _ in {1..40}; do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  log "Timed out waiting for $url"
  return 1
}

trap cleanup INT TERM

: > "$LOG"
log "Starting Agent services for macOS..."

if ! command -v python3 >/dev/null 2>&1; then
  log "python3 is required."
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  log "Node.js is required."
  exit 1
fi

if [[ ! -d "$BACKEND/.venv" ]]; then
  log "Creating backend virtual environment..."
  python3 -m venv "$BACKEND/.venv"
fi

log "Installing backend dependencies..."
"$BACKEND/.venv/bin/python" -m pip install -r "$BACKEND/requirements.txt" >>"$LOG" 2>&1

for app_dir in "$FRONT" "$MOBILE"; do
  if [[ -f "$app_dir/.env.example" && ! -f "$app_dir/.env.local" ]]; then
    cp "$app_dir/.env.example" "$app_dir/.env.local"
  fi
  if [[ "$(uname -s)" == "Darwin" && "$(uname -m)" == "arm64" && -d "$app_dir/node_modules" && ! -d "$app_dir/node_modules/@rollup/rollup-darwin-arm64" ]]; then
    log "Removing incomplete frontend dependencies in $app_dir..."
    rm -rf "$app_dir/node_modules"
  fi
  if [[ ! -d "$app_dir/node_modules" ]]; then
    log "Installing frontend dependencies in $app_dir..."
    (cd "$app_dir" && install_frontend_deps) >>"$LOG" 2>&1
  fi
done

mkdir -p "$BACKEND/storage"

log "Starting backend: http://127.0.0.1:8000"
(cd "$BACKEND" && DISABLE_SQLALCHEMY_CEXT_RUNTIME=1 .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --loop asyncio --http h11 --ws none) >>"$LOG" 2>&1 &
BACKEND_PID="$!"

log "Starting PC frontend: http://127.0.0.1:5173"
(cd "$FRONT" && run_frontend_dev) >>"$LOG" 2>&1 &
FRONT_PID="$!"

log "Starting mobile frontend: http://127.0.0.1:5174"
(cd "$MOBILE" && run_frontend_dev) >>"$LOG" 2>&1 &
MOBILE_PID="$!"

for _ in {1..80}; do
  if curl -fsS "http://127.0.0.1:8000/health" >/dev/null 2>&1; then
    break
  fi
  if ! kill -0 "$BACKEND_PID" >/dev/null 2>&1; then
    log "Backend process exited before becoming ready. See $LOG"
    cleanup
    exit 1
  fi
  sleep 1
done
if ! curl -fsS "http://127.0.0.1:8000/health" >/dev/null 2>&1; then
  log "Timed out waiting for http://127.0.0.1:8000/health"
  cleanup
  exit 1
fi
wait_for_url "http://127.0.0.1:5173"
wait_for_url "http://127.0.0.1:5174"

open "http://127.0.0.1:5173" || true
open "http://127.0.0.1:5174" || true

log "All services are running."
log "PC frontend: http://127.0.0.1:5173"
log "Mobile frontend: http://127.0.0.1:5174"
log "Backend API docs: http://127.0.0.1:8000/docs"
log "Press Ctrl+C in this terminal to stop all three services."

wait
