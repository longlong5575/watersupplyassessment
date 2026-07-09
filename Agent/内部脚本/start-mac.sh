#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
AGENT_PARENT="$(dirname "$AGENT_ROOT")"
if [[ "$(basename "$AGENT_PARENT")" == "watersupplyassessment" ]]; then
  WORKSPACE_ROOT="$(dirname "$AGENT_PARENT")"
else
  WORKSPACE_ROOT="$AGENT_PARENT"
fi
RUNTIME_ROOT="${WATERSUPPLY_RUNTIME_DIR:-$WORKSPACE_ROOT/运行脚本/watersupply-agent-runtime}"
BACKEND="$AGENT_ROOT/backend"
FRONT="$AGENT_ROOT/frontend/front"
MOBILE="$AGENT_ROOT/frontend/front-mobile"
RUNTIME_BACKEND="$RUNTIME_ROOT/backend"
RUNTIME_FRONT="$RUNTIME_ROOT/frontend/front"
RUNTIME_MOBILE="$RUNTIME_ROOT/frontend/front-mobile"
STORAGE_DIR="$RUNTIME_ROOT/storage"
LOG_DIR="$RUNTIME_ROOT/logs"
LOG="$LOG_DIR/startup-mac.log"

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

mkdir -p "$LOG_DIR" "$RUNTIME_BACKEND" "$STORAGE_DIR"
: > "$LOG"
log "Starting Agent services for macOS..."

if ! command -v python3 >/dev/null 2>&1; then
  log "python3 is required."
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  log "缺少 Node.js，请先安装 Node.js。"
  exit 1
fi

if [[ ! -d "$RUNTIME_BACKEND/.venv" ]]; then
  log "Creating backend virtual environment..."
  python3 -m venv "$RUNTIME_BACKEND/.venv"
fi

log "Installing backend dependencies..."
"$RUNTIME_BACKEND/.venv/bin/python" -m pip install --disable-pip-version-check -r "$BACKEND/requirements.txt" >>"$LOG" 2>&1 || \
  "$RUNTIME_BACKEND/.venv/bin/python" -m pip install --disable-pip-version-check --timeout 30 --retries 2 -i https://pypi.tuna.tsinghua.edu.cn/simple -r "$BACKEND/requirements.txt" >>"$LOG" 2>&1

sync_frontend() {
  local source_dir="$1"
  local target_dir="$2"
  mkdir -p "$(dirname "$target_dir")"
  mkdir -p "$target_dir"
  rsync -a --delete --exclude node_modules --exclude dist --exclude .vite --exclude .env.local --exclude '*.log' --exclude '*.pid' "$source_dir/" "$target_dir/"
}

sync_frontend "$FRONT" "$RUNTIME_FRONT"
sync_frontend "$MOBILE" "$RUNTIME_MOBILE"

for app_dir in "$RUNTIME_FRONT" "$RUNTIME_MOBILE"; do
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

log "Starting backend: http://127.0.0.1:8000"
(cd "$BACKEND" && DISABLE_SQLALCHEMY_CEXT_RUNTIME=1 WATERSUPPLY_RUNTIME_DIR="$RUNTIME_ROOT" DATABASE_URL="sqlite:///$STORAGE_DIR/assessment.db" STORAGE_DIR="$STORAGE_DIR" CELERY_TASK_ALWAYS_EAGER=true "$RUNTIME_BACKEND/.venv/bin/python" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --loop asyncio --http h11 --ws none) >>"$LOG" 2>&1 &
BACKEND_PID="$!"

log "Starting PC frontend: http://127.0.0.1:5173"
(cd "$RUNTIME_FRONT" && run_frontend_dev) >>"$LOG" 2>&1 &
FRONT_PID="$!"

log "Starting mobile frontend: http://127.0.0.1:5174"
(cd "$RUNTIME_MOBILE" && run_frontend_dev) >>"$LOG" 2>&1 &
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
