#!/bin/bash
# Creates the database used by lims-whatsapp-service, alongside durdans_lims_db on the
# same instance.
#
# WHY a separate database rather than a schema: the WhatsApp agent must not be able to
# read clinical tables even by accident. It reaches patient data only through
# lims-core-service's HTTP API, under a Keycloak service account with read-only scopes.
# A shared database with shared credentials would make that boundary a convention;
# a separate database makes it something Postgres enforces.
#
# NOTE: Postgres only runs the scripts in this directory when the data volume is EMPTY.
# On a stack that is already running, create it once by hand instead:
#
#   docker compose exec lims-postgres \
#     psql -U postgres -c 'CREATE DATABASE durdans_wa_db'
set -euo pipefail

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE DATABASE durdans_wa_db;
EOSQL

echo "created database durdans_wa_db"
