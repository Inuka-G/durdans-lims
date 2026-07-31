# Durdans Hospital LIMS — Restore Runbook

> **Prepared for:** IFS Sri Lanka senior-engineer review · **Date:** 2026-06-19
> Companion to [DISASTER-RECOVERY.md](DISASTER-RECOVERY.md). Every procedure here has
> been (or can be) executed; the [Drill log](#drill-log) is the captured evidence.

Three recovery paths, fastest first. Pick by the failure: data corruption / accidental
change → **A (PITR)**; lost instance → **B (snapshot)**; lost or corrupt RDS + need the
secondary line, or restoring the Keycloak DB → **C (pg_dump)**.

---

## A. RDS point-in-time restore (RPO ≈ 5 min)

```bash
# 1. Restore to a brand-new instance at the chosen time (does NOT touch the live DB).
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier durdans-lims-prod-db \
  --target-db-instance-identifier durdans-lims-prod-db-restore \
  --restore-time 2026-06-19T06:55:00Z \
  --db-subnet-group-name durdans-lims-prod-db-subnets \
  --no-publicly-accessible

# 2. Wait until available, then sanity-check row counts / Liquibase checksum.
aws rds wait db-instance-available --db-instance-identifier durdans-lims-prod-db-restore

# 3. Cutover (see § Cutover).
```

## B. Restore from an automated/manual snapshot (lost instance)

```bash
aws rds describe-db-snapshots --db-instance-identifier durdans-lims-prod-db \
  --query 'reverse(sort_by(DBSnapshots,&SnapshotCreateTime))[].DBSnapshotIdentifier' --output table

aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier durdans-lims-prod-db-restore \
  --db-snapshot-identifier <chosen-snapshot> \
  --db-subnet-group-name durdans-lims-prod-db-subnets \
  --no-publicly-accessible
```

## C. Restore from a `pg_dump` (secondary line; also the Keycloak DB path)

Uses [`pg-restore.sh`](../infra/scripts/pg-restore.sh).

```bash
# From S3 (prod): pull the chosen dump and restore into a target DB.
TARGET_DB=durdans_lims_db \
S3_BUCKET=durdans-lims-prod-backups-xxxx \
S3_KEY=durdans_lims_db_20260619T020000Z.dump \
PGHOST=<restored-host> PGUSER=lims_app PGPASSWORD=<secret> \
  ./infra/scripts/pg-restore.sh --run

# Keycloak DB is identical with TARGET_DB=keycloak and the keycloak_*.dump key.
```

## Cutover

1. Point the app's DB secret/URL at the restored host. With Secrets Manager: update the
   `host`/`url` in the `…/db` secret, then restart the app container
   (`docker compose restart app`) so it re-reads the secret.
2. Confirm Liquibase reports **no** pending changesets and the app's `/actuator/health`
   (internal port 11001) is `UP`.
3. Spot-check: a recent patient, a verified result, and **the audit chain**
   (`GET /api/v1/audit-logs/verify-chain` as SUPER_ADMIN must return `valid: true`).
4. Decommission the old/failed instance once the restore is confirmed.

---

## Drill log

A backup is only real once a restore is proven. The logical-backup path
(`pg-backup.sh` → simulated data loss → `pg-restore.sh` → verification) was executed
end-to-end against a Postgres 15 instance.

- **Date:** 2026-06-19 (UTC stamp `20260619T071020Z`)
- **Method:** seed 120 rows → `pg-backup.sh --run` (dumped both `durdans_lims_db` and
  `keycloak`) → `DROP TABLE patient` (simulated loss) → `pg-restore.sh --run` → verify.
- **Result:** **PASS** — 120 rows restored, matching the source.

```text
=== 2. seed app DB (120 rows) ===
source patient rows: 120
=== 3. pg-backup.sh --run ===
pg-backup.sh @ 20260619T071020Z
  app DB:      postgres@localhost:5432/durdans_lims_db
  keycloak DB: postgres@localhost:5432/keycloak
Dumping durdans_lims_db -> /backups/durdans_lims_db_20260619T071020Z.dump
Dumping keycloak       -> /backups/keycloak_20260619T071020Z.dump
Backup complete @ 20260619T071020Z
=== 4. SIMULATE DISASTER: drop the patient table ===
patient table present after disaster: 0
=== 5. pg-restore.sh --run ===
Ensuring target database exists...
Restoring (--clean --if-exists) into durdans_lims_db...
Restore complete. Verify row counts against the source before cutover.
=== 6. VERIFY ===
restored patient rows: 120  (source was 120)
DRILL RESULT: PASS — row counts match
```

**Re-run the drill** any time (Docker required):

```bash
# In a throwaway container, exercises the real scripts; see the session that produced
# the transcript above. Safe — uses an ephemeral postgres:15, removed at the end.
```
