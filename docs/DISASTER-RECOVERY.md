# Durdans Hospital LIMS — Disaster Recovery (Backup, RPO/RTO, Standby)

> **Prepared for:** IFS Sri Lanka senior-engineer review · **Date:** 2026-06-19
> **Scope:** the three persistent data stores — RDS app DB, Keycloak DB, S3 patient
> documents. Closes the roadmap's #2 blocker ("No backup / DR / RPO / RTO").
> See the **tested** procedures in [RESTORE-RUNBOOK.md](RESTORE-RUNBOOK.md).

---

## 1. Data stores and their backup mechanisms

| Data store | Where it lives (prod) | Primary backup | Secondary backup | Contains |
|---|---|---|---|---|
| **App DB** (`durdans_lims_db`) | RDS PostgreSQL `db.t4g.micro` | RDS automated backups + **PITR** (7-day window) | Nightly `pg_dump` → encrypted S3 backups bucket | All clinical data, results, audit chain |
| **Keycloak DB** (`keycloak`) | Postgres container on the EC2 host | — (not on RDS) | Nightly `pg_dump` → encrypted S3 backups bucket | Users, roles, realm config |
| **Patient documents** | S3 (`*-patient-docs-*`) | S3 versioning + SSE, 11-nines durability | — | Uploaded PHI documents |

The app DB has **two independent backup lines**; the Keycloak DB is the one that is
*only* covered by the logical `pg_dump` line — easy to forget because it does **not**
run on RDS. The backup job ([`pg-backup.sh`](../infra/scripts/pg-backup.sh))
explicitly dumps **both** databases.

## 2. RPO / RTO targets

| Data store | RPO (max data loss) | RTO (time to restore) | How it is met |
|---|---|---|---|
| App DB — PITR | **≈ 5 min** | 30–60 min | RDS continuous WAL → restore-to-point-in-time, then cutover |
| App DB — nightly dump | 24 h | 30–60 min | `pg_restore` from the most recent S3 dump |
| Keycloak DB | 24 h | 15–30 min | `pg_restore` of the nightly dump onto the host Postgres |
| Patient docs (S3) | ≈ 0 | minutes | Object versioning; restore a prior version |

These are demo-scale targets sized to the single-node deployment in
[PRODUCTION-READINESS-ROADMAP.md](PRODUCTION-READINESS-ROADMAP.md) §2; the production
target (Multi-AZ, cross-region) tightens RPO to near-zero with automatic failover.

## 3. Standby / PITR / WAL narrative

- **WAL archiving is not hand-rolled.** On RDS, automated backups + PITR are the
  managed equivalent of `archive_command` + a WAL archive — Amazon streams the WAL
  continuously and lets you restore to any second in the retention window. There is no
  benefit to running our own `archive_command` against RDS, so we don't.
- **Standby / failover** is the documented production promotion: set
  `rds_multi_az = true` (Terraform var) to get a synchronous standby in a second AZ
  with automatic failover. It is **off by default** because it roughly doubles the DB
  cost and would break the ~$34/mo review budget — it is a one-variable flip, not a
  rewrite.
- **Local / demo stack** has no WAL archiving: the throwaway compose Postgres is
  backed up only by the `db-backup` sidecar's nightly `pg_dump`. Stated plainly so no
  one assumes PITR locally.

## 4. Backup automation

- **AWS prod:** RDS automated backups (7-day PITR) are provisioned in
  [`terraform/database.tf`](../infra/terraform/database.tf). The
  secondary nightly logical dump runs on the EC2 host (cron / sidecar) via
  `pg-backup.sh`, uploading to the encrypted, versioned **backups** bucket
  ([`terraform/storage.tf`](../infra/terraform/storage.tf)); the EC2
  instance role is granted `s3:PutObject` on that bucket only
  ([`terraform/iam.tf`](../infra/terraform/iam.tf)).
- **Local / demo:** the `db-backup` compose service runs `pg-backup.sh` on a schedule
  against both Postgres containers into a named `backups` volume.

## 5. Residual risk (disclosed, not hidden)

| Risk | Current posture | Mitigation / promotion path |
|---|---|---|
| Single-AZ RDS | An AZ outage = downtime until restore | `rds_multi_az = true` (var-gated) |
| Single region / account | Region/account loss is unrecoverable | Enable cross-region automated-backup replication; copy dumps to a second-region bucket |
| `skip_final_snapshot = true` | `terraform destroy` drops the DB with no final snapshot | `rds_skip_final_snapshot = false` (var-gated) names a final snapshot |
| `deletion_protection = false` | Accidental delete possible | `rds_deletion_protection = true` (var-gated) |
| Keycloak DB on host volume | Lost if the EC2 instance is terminated | Covered by the nightly dump → S3; promote Keycloak to RDS for prod |

The DR knobs above are Terraform variables with safe demo defaults, so production flips
them without editing HCL. See `variables.tf` (`rds_multi_az`,
`rds_deletion_protection`, `rds_skip_final_snapshot`).

## 6. Proof it works

The restore path is **drill-tested** (dump → simulated data loss → restore → row-count
verification). The captured transcript is in
[RESTORE-RUNBOOK.md § Drill log](RESTORE-RUNBOOK.md#drill-log) — a backup is worthless
until a restore is proven, so the runbook carries evidence, not just instructions.
