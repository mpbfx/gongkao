#!/usr/bin/env bash

set -Eeuo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
requested_port="${CODEX_PORT:-3002}"
listen_host="${CODEX_HOST:-0.0.0.0}"
update_source=false
with_qdrant=false
skip_install=false

usage() {
  cat <<'EOF'
Usage: pnpm codex:start [options]

Options:
  --port PORT       Preferred dev-server port (default: 3002)
  --update          Fetch and fast-forward to origin/main before startup
  --with-qdrant     Start Qdrant when port 6333 is not available
  --skip-install    Fail instead of installing missing dependencies
  -h, --help        Show this help

Environment:
  CODEX_PORT        Same as --port
  CODEX_HOST        Next.js listen host (default: 0.0.0.0)
  CODEX_AUTH_URL    Override the auto-detected LAN AUTH_URL
EOF
}

log() {
  printf '[codex-start] %s\n' "$*"
}

fail() {
  printf '[codex-start] ERROR: %s\n' "$*" >&2
  exit 1
}

while (($# > 0)); do
  case "$1" in
    --port)
      (($# >= 2)) || fail "--port requires a value"
      requested_port="$2"
      shift 2
      ;;
    --update)
      update_source=true
      shift
      ;;
    --with-qdrant)
      with_qdrant=true
      shift
      ;;
    --skip-install)
      skip_install=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "unknown option: $1"
      ;;
  esac
done

[[ "$requested_port" =~ ^[0-9]+$ ]] || fail "port must be numeric"
((requested_port >= 1024 && requested_port <= 65535)) || fail "port must be between 1024 and 65535"

cd "$repo_root"

select_node() {
  local major minor nvm_path

  if command -v node >/dev/null 2>&1; then
    major="$(node -p 'process.versions.node.split(".")[0]')"
    minor="$(node -p 'process.versions.node.split(".")[1]')"
    if ((major >= 24 || major == 22 && minor >= 12 || major == 20 && minor >= 19)); then
      return
    fi
  fi

  nvm_path="${NVM_DIR:-${HOME}/.nvm}/nvm.sh"
  [[ -s "$nvm_path" ]] || fail "Node 20.19+, 22.12+, or 24+ is required; nvm was not found"

  # shellcheck source=/dev/null
  source "$nvm_path"
  if nvm use 24.16.0 >/dev/null 2>&1 || nvm use 24 >/dev/null 2>&1; then
    return
  fi

  fail "install Node 24 with: nvm install 24"
}

port_is_open() {
  nc -z 127.0.0.1 "$1" >/dev/null 2>&1
}

detect_lan_ip() {
  local default_interface lan_ip

  default_interface="$(route -n get default 2>/dev/null | awk '/interface:/{print $2; exit}')"
  if [[ -n "$default_interface" ]]; then
    lan_ip="$(ipconfig getifaddr "$default_interface" 2>/dev/null || true)"
    if [[ -z "$lan_ip" ]]; then
      lan_ip="$(ifconfig "$default_interface" 2>/dev/null | awk '/inet / && $2 != "127.0.0.1" {print $2; exit}')"
    fi
  fi

  printf '%s' "$lan_ip"
}

wait_for_port() {
  local port="$1" label="$2" attempt
  for attempt in $(seq 1 60); do
    if port_is_open "$port"; then
      log "$label is ready on port $port"
      return
    fi
    sleep 1
  done
  fail "$label did not become ready on port $port"
}

ensure_disk_space() {
  local available_kb
  available_kb="$(df -Pk "$repo_root" | awk 'NR == 2 {print $4}')"
  ((available_kb >= 3 * 1024 * 1024)) || fail "dependency install needs at least 3 GB free disk space"
}

if $update_source; then
  [[ -z "$(git status --porcelain)" ]] || fail "--update requires a clean worktree"
  log "fetching origin/main"
  git fetch origin main
  git merge-base --is-ancestor HEAD origin/main || fail "origin/main is not a fast-forward from HEAD"
  git merge --ff-only origin/main
fi

[[ -f .env.local ]] || fail ".env.local is missing; create it from .env.example and add local credentials"
command -v docker >/dev/null 2>&1 || fail "Docker is required"
docker info >/dev/null 2>&1 || fail "Docker Desktop is not running"

select_node
command -v pnpm >/dev/null 2>&1 || fail "pnpm is required"
log "using Node $(node -v) and pnpm $(pnpm --version)"

if port_is_open 3306; then
  log "using the existing database service on port 3306"
else
  log "starting MariaDB"
  docker compose -f docker-compose.dev.yml up -d mariadb
  wait_for_port 3306 "MariaDB"
fi

if grep -Eq '^QDRANT_URL=.+$' .env.local; then
  with_qdrant=true
fi

if $with_qdrant; then
  if port_is_open 6333; then
    log "using the existing Qdrant service on port 6333"
  else
    log "starting Qdrant"
    docker compose -f docker-compose.dev.yml up -d qdrant
    wait_for_port 6333 "Qdrant"
  fi
fi

dependencies_ready() {
  [[ -x node_modules/.bin/next ]] &&
    [[ -x node_modules/.bin/prisma ]] &&
    [[ -d node_modules/@qdrant/js-client-rest ]] &&
    [[ -d node_modules/@tailwindcss/postcss ]]
}

if ! dependencies_ready; then
  $skip_install && fail "dependencies are incomplete and --skip-install was provided"
  ensure_disk_space
  log "installing dependencies"
  pnpm install --ignore-scripts --lockfile=false
fi

log "generating Prisma client"
pnpm exec prisma generate
log "applying database migrations"
pnpm exec prisma migrate deploy

port="$requested_port"
while port_is_open "$port"; do
  existing_pid="$(lsof -tiTCP:"$port" -sTCP:LISTEN | head -n 1 || true)"
  existing_cwd=""
  if [[ -n "$existing_pid" ]]; then
    existing_cwd="$(lsof -a -p "$existing_pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -n 1)"
  fi
  if [[ "$existing_cwd" == "$repo_root" ]]; then
    log "Gongkao is already running at http://localhost:$port"
    exit 0
  fi
  ((port += 1))
  ((port <= requested_port + 20)) || fail "no free port found near $requested_port"
done

lan_ip="$(detect_lan_ip)"
if [[ -n "${CODEX_AUTH_URL:-}" ]]; then
  auth_url="$CODEX_AUTH_URL"
elif [[ -n "$lan_ip" ]]; then
  auth_url="http://$lan_ip:$port"
else
  auth_url="http://localhost:$port"
fi

export AUTH_URL="$auth_url"
log "starting Gongkao at $AUTH_URL"
if [[ -n "$lan_ip" ]]; then
  log "LAN access: http://$lan_ip:$port"
fi
exec pnpm dev --hostname "$listen_host" --port "$port"
