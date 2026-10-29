#!/bin/sh
# Applies pending SQL migrations tracked in schema_migrations,
# then content seeds (db/seeds/*.sql) whose contents changed (seed_versions).
# Usage (Docker): mounted at /migrate.sh with /migrations/*.sql and /seeds/*.sql
# Usage (local):  ./db/migrate.sh [migrations_dir] [seeds_dir]
#
# Env: PGHOST (default localhost), PGPORT (5432), POSTGRES_USER, POSTGRES_DB, PGPASSWORD

set -eu

MIGRATIONS_DIR="${1:-/migrations}"
SEEDS_DIR="${2:-}"
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

# ── Сиды контента ────────────────────────────────────────────────────────────
# Сид применяется заново, только если изменилось его содержимое (sha256).
# Сиды идемпотентны: повторное применение не создаёт дублей.

if [ -z "$SEEDS_DIR" ] || [ ! -d "$SEEDS_DIR" ]; then
  exit 0
fi

checksum() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | cut -d' ' -f1
  else
    shasum -a 256 "$1" | cut -d' ' -f1
  fi
}

psql_base <<'SQL'
CREATE TABLE IF NOT EXISTS seed_versions (
  filename TEXT PRIMARY KEY,
  checksum TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
SQL

for file in $(find "$SEEDS_DIR" -maxdepth 1 -type f -name '*.sql' | sort); do
  filename=$(basename "$file")
  sum=$(checksum "$file")
  current=$(psql_base -Atc "SELECT checksum FROM seed_versions WHERE filename = '$filename'" || true)

  if [ "$current" = "$sum" ]; then
    echo "Seed up to date: $filename"
    continue
  fi

  echo "Applying seed: $filename"
  psql_base -q -f "$file"
  psql_base -c "INSERT INTO seed_versions (filename, checksum) VALUES ('$filename', '$sum')
                ON CONFLICT (filename) DO UPDATE SET checksum = EXCLUDED.checksum, applied_at = NOW()"
done

echo "Seeds done."
