#!/usr/bin/env bash
# =====================================================================
# pg-restore.sh — restore a LIMS database from a pg_dump produced by pg-backup.sh
# (H5 / D3). Used by the restore runbook and the restore DRILL.
#
#   ⚠ DESTRUCTIVE: --clean drops and recreates every object in the target DB.
#     Restore into a NEW/empty database or a throwaway instance first; only
#     overwrite a live DB during a real recovery, after confirming the target.
#
# Config (env):
#   PGHOST / PGPORT / PGUSER / PGPASSWORD   target server (default localhost:5432 postgres/postgres)
#   TARGET_DB                               database to restore INTO (required)
#   DUMP_FILE                               local .dump to restore (required unless S3_KEY given)
#   S3_BUCKET / S3_KEY                      pull the dump from S3 first (optional)
#
# Usage:
#   TARGET_DB=durdans_lims_db DUMP_FILE=/backups/durdans_lims_db_20260619T....dump ./pg-restore.sh --run
#   TARGET_DB=durdans_lims_db S3_BUCKET=my-backups S3_KEY=durdans_lims_db_....dump ./pg-restore.sh --run
# =====================================================================
set -euo pipefail

PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-postgres}"
PGPASSWORD="${PGPASSWORD:-postgres}"
TARGET_DB="${TARGET_DB:?set TARGET_DB to the database to restore into}"
DUMP_FILE="${DUMP_FILE:-}"
S3_BUCKET="${S3_BUCKET:-}"
S3_KEY="${S3_KEY:-}"

DRY_RUN=1
[[ "${1:-}" == "--run" ]] && DRY_RUN=0

if [[ -z "$DUMP_FILE" && -n "$S3_BUCKET" && -n "$S3_KEY" ]]; then
  DUMP_FILE="/tmp/${S3_KEY}"
  echo "Will pull s3://${S3_BUCKET}/${S3_KEY} -> ${DUMP_FILE}"
fi
: "${DUMP_FILE:?set DUMP_FILE or S3_BUCKET+S3_KEY}"

echo "pg-restore.sh"
echo "  target:  ${PGUSER}@${PGHOST}:${PGPORT}/${TARGET_DB}"
echo "  dump:    ${DUMP_FILE}"

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "DRY RUN — re-run with --run to perform the restore (DESTRUCTIVE)."
  exit 0
fi

if [[ -n "$S3_BUCKET" && -n "$S3_KEY" && ! -f "$DUMP_FILE" ]]; then
  aws s3 cp "s3://${S3_BUCKET}/${S3_KEY}" "$DUMP_FILE"
fi

echo "Ensuring target database exists..."
PGPASSWORD="$PGPASSWORD" psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -tc \
  "SELECT 1 FROM pg_database WHERE datname='${TARGET_DB}'" | grep -q 1 \
  || PGPASSWORD="$PGPASSWORD" createdb -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" "$TARGET_DB"

echo "Restoring (--clean --if-exists) into ${TARGET_DB}..."
PGPASSWORD="$PGPASSWORD" pg_restore --clean --if-exists --no-owner --no-privileges \
  -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$TARGET_DB" "$DUMP_FILE"

echo "Restore complete. Verify row counts against the source before cutover."
