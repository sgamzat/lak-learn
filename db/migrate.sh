#!/bin/sh
# Applies pending SQL migrations tracked in schema_migrations.
# Usage (Docker): mounted at /migrate.sh with /migrations/*.sql
# Usage (local):  ./db/migrate.sh [migrations_dir]
#
# Env: PGHOST (default localhost), PGPORT (5432), POSTGRES_USER, POSTGRES_DB, PGPASSWORD

set -eu

MIGRATIONS_DIR="${1:-/migrations}"
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
POSTGRES_USER="${POSTGRES_USER:-lak_user}"
POSTGRES_DB="${POSTGRES_DB:-lak_learn}"

if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "Migrations directory not found: $MIGRATIONS_DIR" >&2
  exit 1
fi

psql_base() {
  psql -h "$PGHOST" -p "$PGPORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 "$@"
}

echo "Ensuring schema_migrations table exists..."
psql_base <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
SQL

applied_count=0
skipped_count=0

# Locale-independent sorted order by filename
for file in $(find "$MIGRATIONS_DIR" -maxdepth 1 -type f -name '*.sql' | sort); do
  filename=$(basename "$file")

  already=$(psql_base -Atc "SELECT 1 FROM schema_migrations WHERE filename = '$filename' LIMIT 1" || true)

  if [ "$already" = "1" ]; then
    echo "Skip (already applied): $filename"
    skipped_count=$((skipped_count + 1))
    continue
  fi

  echo "Applying: $filename"
  psql_base -f "$file"
  psql_base -c "INSERT INTO schema_migrations (filename) VALUES ('$filename')"
  applied_count=$((applied_count + 1))
done

echo "Migrations done. Applied: $applied_count, skipped: $skipped_count"
