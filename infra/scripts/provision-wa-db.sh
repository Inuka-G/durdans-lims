#!/usr/bin/env bash
# Create the WhatsApp agent's own Postgres role and database on the LIMS RDS
# instance, and install the helper that refreshes its Meta credentials.
#
# Lives in S3 rather than inline in user_data for the same reason deploy-service.sh
# does: EC2 caps user_data at 16 KB, and inlining this pushed the bootstrap over it.
#
# Idempotent. bootstrap.sh runs it on every instance replacement while RDS survives
# them, so both objects usually already exist.
#
# WHY a separate role and database rather than reusing the LIMS credentials: the
# agent must not be able to read clinical tables even by accident. Nothing is granted
# to this role on durdans_lims_db, which makes the isolation something Postgres
# enforces rather than something the design merely intends.
#
# Reads everything from /opt/lims/.env, which bootstrap.sh has already written.

set -Eeuo pipefail
cd /opt/lims

env_value() { sed -n "s/^$1=//p" .env | tail -n 1; }

DB_USERNAME="$(env_value DB_USERNAME)"
DB_PASSWORD="$(env_value DB_PASSWORD)"
DB_URL="$(env_value DB_URL)"
WA_DB_USERNAME="$(env_value WA_DB_USERNAME)"
WA_DB_PASSWORD="$(env_value WA_DB_PASSWORD)"
WA_DB_URL="$(env_value WA_DB_URL)"

if [[ -z "${WA_DB_USERNAME}" || -z "${WA_DB_URL}" ]]; then
  echo "WhatsApp DB credentials are absent from .env; skipping provisioning" >&2
  exit 0
fi

# jdbc:postgresql://host:port/dbname -> the three parts psql needs. Derived rather
# than passed in so bootstrap.sh does not have to carry three more exports.
strip_jdbc() { printf '%s' "${1#jdbc:postgresql://}"; }
hostport="$(strip_jdbc "${DB_URL}")"; hostport="${hostport%%/*}"
DB_HOST="${hostport%%:*}"
DB_PORT="${hostport##*:}"
DB_NAME="$(strip_jdbc "${DB_URL}")"; DB_NAME="${DB_NAME##*/}"
WA_DB_NAME="$(strip_jdbc "${WA_DB_URL}")"; WA_DB_NAME="${WA_DB_NAME##*/}"

# psql is not installed on AL2023, so borrow it from the postgres image that is
# already pulled for Keycloak's database.
psql_admin() {
  docker run --rm -e PGPASSWORD="${DB_PASSWORD}" postgres:15 \
    psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USERNAME}" -d "${DB_NAME}" \
      -v ON_ERROR_STOP=1 "$@"
}

if psql_admin -tAc "SELECT 1 FROM pg_roles WHERE rolname = '${WA_DB_USERNAME}'" | grep -q 1; then
  # Keep the role's password in step with the secret after a rotation.
  psql_admin -c "ALTER ROLE \"${WA_DB_USERNAME}\" WITH PASSWORD '${WA_DB_PASSWORD}'"
else
  # The generated password's charset excludes a single quote, so this literal is safe.
  psql_admin -c "CREATE ROLE \"${WA_DB_USERNAME}\" LOGIN PASSWORD '${WA_DB_PASSWORD}'"
  echo "created postgres role ${WA_DB_USERNAME}"
fi

if ! psql_admin -tAc "SELECT 1 FROM pg_database WHERE datname = '${WA_DB_NAME}'" | grep -q 1; then
  psql_admin -c "CREATE DATABASE \"${WA_DB_NAME}\" OWNER \"${WA_DB_USERNAME}\""
  echo "created database ${WA_DB_NAME}"
fi

echo "whatsapp database provisioning complete"
