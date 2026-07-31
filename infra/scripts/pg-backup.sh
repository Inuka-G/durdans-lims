#!/usr/bin/env bash
# =====================================================================
# pg-backup.sh — logical backup of the LIMS Postgres databases (H5 / D3).
#
# Takes a compressed custom-format pg_dump of each target database, names it with
# a UTC timestamp, optionally uploads it to the encrypted S3 backups bucket, and
# prunes local dumps older than the retention window. Safe to run from cron, the
# compose "db-backup" sidecar, or by hand.
#
# This is the SECONDARY backup line (defence-in-depth + the only backup for the
# Keycloak DB, which runs on the EC2 host, not RDS). The PRIMARY line for the app
# DB is RDS automated backups + PITR (see docs/DISASTER-RECOVERY.md).
#
# Config (env, with sensible local-stack defaults):
#   PGHOST_APP / PGPORT_APP / DB_APP        app DB   (default lims-postgres:5432 / durdans_lims_db)
#   PGHOST_KC  / PGPORT_KC  / DB_KC         keycloak (default postgres:5432 / keycloak)
#   PGUSER / PGPASSWORD                     credentials (default postgres/postgres)
#   KC_USER / KC_PASSWORD                   keycloak DB creds (default keycloak/keycloak)
#   BACKUP_DIR                              local output dir   (default /backups)
#   RETENTION_DAYS                          prune older dumps  (default 14)
#   S3_BUCKET                               upload target      (optional; skipped if empty)
#
# Usage:
#   ./pg-backup.sh            # dry-run: prints the plan, takes no dump
#   ./pg-backup.sh --run      # take the backups (and upload if S3_BUCKET set)
# =====================================================================
set -euo pipefail

PGHOST_APP="${PGHOST_APP:-lims-postgres}"
PGPORT_APP="${PGPORT_APP:-5432}"
DB_APP="${DB_APP:-durdans_lims_db}"
PGHOST_KC="${PGHOST_KC:-postgres}"
PGPORT_KC="${PGPORT_KC:-5432}"
DB_KC="${DB_KC:-keycloak}"
PGUSER="${PGUSER:-postgres}"
PGPASSWORD="${PGPASSWORD:-postgres}"
KC_USER="${KC_USER:-keycloak}"
KC_PASSWORD="${KC_PASSWORD:-keycloak}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
S3_BUCKET="${S3_BUCKET:-}"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DRY_RUN=1
[[ "${1:-}" == "--run" ]] && DRY_RUN=0

echo "pg-backup.sh @ ${STAMP}"
echo "  app DB:      ${PGUSER}@${PGHOST_APP}:${PGPORT_APP}/${DB_APP}"
echo "  keycloak DB: ${KC_USER}@${PGHOST_KC}:${PGPORT_KC}/${DB_KC}"
echo "  out dir:     ${BACKUP_DIR}   retention: ${RETENTION_DAYS}d   s3: ${S3_BUCKET:-<none>}"

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "DRY RUN — re-run with --run to take the backups."
  exit 0
fi

mkdir -p "$BACKUP_DIR"

dump_one() {
  local host="$1" port="$2" db="$3" user="$4" pass="$5"
  local out="${BACKUP_DIR}/${db}_${STAMP}.dump"
  echo "Dumping ${db} -> ${out}"
  PGPASSWORD="$pass" pg_dump -Fc -h "$host" -p "$port" -U "$user" "$db" -f "$out"
  echo "  $(du -h "$out" | cut -f1)  ${out}"
  if [[ -n "$S3_BUCKET" ]]; then
    echo "  uploading to s3://${S3_BUCKET}/$(basename "$out")"
    aws s3 cp "$out" "s3://${S3_BUCKET}/$(basename "$out")" --sse AES256
  fi
}

dump_one "$PGHOST_APP" "$PGPORT_APP" "$DB_APP" "$PGUSER" "$PGPASSWORD"
dump_one "$PGHOST_KC"  "$PGPORT_KC"  "$DB_KC"  "$KC_USER" "$KC_PASSWORD"

echo "Pruning local dumps older than ${RETENTION_DAYS} days"
find "$BACKUP_DIR" -name '*.dump' -type f -mtime "+${RETENTION_DAYS}" -print -delete || true

echo "Backup complete @ ${STAMP}"
