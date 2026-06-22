#!/usr/bin/env bash
# Local Postgres cluster for EcoDharma dev/e2e — no Docker required.
# Runs a bare PG cluster on :54322 and applies all supabase/migrations in order.
# Usage: scripts/dev-db.sh [init|start|stop|reset|status|apply]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PGDATA="$ROOT/.pgdata"
PORT="${ECODHARMA_PGPORT:-54322}"
PGUSER="postgres"
DB="postgres"
export PGHOST=127.0.0.1
export PGPORT="$PORT"
LOG="$PGDATA/server.log"
CONN="postgresql://$PGUSER:postgres@127.0.0.1:$PORT/$DB"

init() {
  if [ -d "$PGDATA" ]; then echo "PGDATA exists at $PGDATA"; return 0; fi
  echo "initdb -> $PGDATA"
  initdb -U "$PGUSER" -A trust -D "$PGDATA" >/dev/null
  echo "unix_socket_directories = '$PGDATA'" >> "$PGDATA/postgresql.conf"
  echo "port = $PORT" >> "$PGDATA/postgresql.conf"
}

start() {
  if pg_ctl -D "$PGDATA" status >/dev/null 2>&1; then echo "already running"; return 0; fi
  pg_ctl -D "$PGDATA" -l "$LOG" -o "-p $PORT -k '$PGDATA'" -w start
  echo "postgres up on :$PORT"
}

stop() { pg_ctl -D "$PGDATA" -m fast stop || true; }
status() { pg_ctl -D "$PGDATA" status || true; }

apply() {
  for f in "$ROOT"/supabase/migrations/*.sql; do
    echo "  applying $(basename "$f")"
    psql "$CONN" -v ON_ERROR_STOP=1 -q -f "$f"
  done
  echo "migrations applied"
}

reset() {
  stop || true
  rm -rf "$PGDATA"
  init
  start
  apply
}

case "${1:-start}" in
  init) init ;;
  start) init; start ;;
  stop) stop ;;
  status) status ;;
  apply) apply ;;
  reset) reset ;;
  *) echo "usage: $0 [init|start|stop|reset|status|apply]"; exit 1 ;;
esac
