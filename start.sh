#!/usr/bin/env bash
# Starts the whole Overlap app: MariaDB, schema + DB user, React build, PHP server.
set -euo pipefail
cd "$(dirname "$0")"
PORT="${PORT:-8080}"
DB_USER="${OVERLAP_DB_USER:-overlap}"
DB_PASS="${OVERLAP_DB_PASS:-overlap_dev}"

for cmd in php mariadb node npm; do
  command -v "$cmd" >/dev/null || { echo "Missing '$cmd'. Install with: brew install php mariadb node"; exit 1; }
done

if ! mariadb -e "select 1" >/dev/null 2>&1; then
  echo "Starting MariaDB…"
  brew services start mariadb >/dev/null
  for _ in $(seq 1 20); do mariadb -e "select 1" >/dev/null 2>&1 && break; sleep 1; done
fi

echo "Setting up database…"
mariadb < db/schema.sql
mariadb -e "CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS'; GRANT ALL ON overlap.* TO '$DB_USER'@'localhost';"

echo "Building React app…"
(cd web && { [ -d node_modules ] || npm install; } && npm run build >/dev/null)

echo "Overlap running at http://localhost:$PORT/  (Ctrl+C to stop)"
exec php -S "localhost:$PORT" -t public public/router.php
