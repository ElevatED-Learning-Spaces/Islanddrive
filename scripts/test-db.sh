#!/usr/bin/env bash
# Applies every migration to a throwaway Postgres database (with Supabase
# stubs) and runs supabase/tests/*.test.sql. Needs a local Postgres 15+ and
# permission to create databases (PGHOST/PGUSER as usual).
set -euo pipefail
cd "$(dirname "$0")/.."
DB="islanddrive_test_$$"
createdb "$DB"
trap 'dropdb --if-exists "$DB" >/dev/null 2>&1 || true' EXIT
run() { psql -X -q -v ON_ERROR_STOP=1 -d "$DB" "$@"; }
run -f supabase/tests/stubs.sql
for f in supabase/migrations/*.sql; do run -f "$f"; done
for t in supabase/tests/*.test.sql; do
  echo "── $t"
  run -f "$t"
done
echo "database tests passed"
