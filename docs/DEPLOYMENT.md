# Durdans LIMS — Deployment & Operations Runbook

Covers the two deployment targets: the **local/demo stack** (one-command Docker
Compose) and the **AWS** environment (Terraform). Both ship the same images.

---

## 1. Local / demo stack (Docker Compose)

Brings up **every** service as a container — app, frontend, Keycloak, 2× Postgres,
Kafka, LocalStack (S3), Prometheus, Grafana — with healthchecks and ordered
start-up (`depends_on: condition: service_healthy`).

```bash
cd infra
cp .env.example .env          # set DB/Keycloak/Grafana passwords
docker compose up -d --build  # first run builds the app + frontend images
docker compose ps             # all services Up (healthy)
```

| Service   | URL                          | Notes |
|-----------|------------------------------|-------|
| Frontend  | http://localhost:3000        | Next.js standalone |
| API       | http://localhost:11000       | Spring Boot; `/api/**` requires a JWT |
| Keycloak  | http://localhost:8081        | realm `lims-realm` (auto-imported) |
| Prometheus| http://localhost:9090        | scrapes the app's internal mgmt port |
| Grafana   | http://localhost:3001        | admin password from `.env` |

**Internal management port (11001)** is deliberately NOT published — actuator
health/metrics are reachable only on the private network; the public API port
(11000) returns 404 for `/actuator/**`.

Stop / wipe:
```bash
docker compose down            # stop (keep volumes/data)
docker compose down -v         # stop + delete all data
```

### Verified working (2026-06-19)
`docker compose up` was run end-to-end. Observed:
- All 9 services reach `Up (healthy)`; app starts only after DB/Kafka/LocalStack are healthy.
- App applies all Liquibase changesets against the containerized DB on first boot.
- `GET /api/v1/patients` → **401** unauthenticated (security enforced); `/actuator/health` on 11000 → **404** (not exposed publicly).
- Prometheus targets `lims-core-service` and `keycloak` both report **UP**.
- Frontend serves (307 redirect to login); Keycloak `/realms/lims-realm` → **200**.

---

## 2. AWS deployment (Terraform)

Cost-optimized single-EC2 + RDS + S3 target (~$34/mo; see
`infra/terraform/README.md` for the full breakdown and the ECS
"production target" plan).

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars   # set alert_email
terraform init && terraform apply
# outputs: frontend_url, api_url, keycloak_url, ecr_*_repo, ssm_session_command
```

Then push images (CI does this automatically) and browse `frontend_url`.

**Operate the host without SSH:**
```bash
aws ssm start-session --target <instance-id>   # from the ssm_session_command output
```

**Cost hygiene:** stop the instance when not demoing (`aws ec2 stop-instances …`);
RDS keeps the data. The Budget alarm emails at 80%/100% of the monthly target.

---

## 3. CI/CD flow

| Repo | Workflow | On push to `main`/`enterprise-hardening` |
|------|----------|------------------------------------------|
| lims-core-service | `ci.yml` + `release.yml` | build+test, gitleaks, CodeQL → image → **Trivy** → ECR → **SSM deploy** |
| frontend | `ci.yml` | lint, `tsc --noEmit`, build → image → Trivy → ECR → deploy |
| lims-infrastructure | `terraform.yml` | fmt, validate, **Checkov** |

Deploy auth is **keyless** (GitHub OIDC → the `…-gha-deploy` IAM role from
Terraform). Set these repo **variables** after `terraform apply`:
- `AWS_DEPLOY_ROLE_ARN` = `github_actions_role_arn` output
- `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_KEYCLOAK_URL` = the EIP/domain URLs

---

## 3a. Backups & disaster recovery (H5)

- **App DB:** RDS automated backups + 7-day **PITR** (primary) and a nightly
  `pg_dump` → encrypted S3 backups bucket (secondary). **Keycloak DB:** nightly
  `pg_dump` only (it is not on RDS).
- **Local/demo:** the `db-backup` compose sidecar runs
  [`scripts/pg-backup.sh`](../infra/scripts/pg-backup.sh) nightly into the
  `backups` volume (set `BACKUP_S3_BUCKET` to also push off-host).
- **RPO/RTO + residual risk:** [DISASTER-RECOVERY.md](DISASTER-RECOVERY.md).
- **Restore procedures (PITR / snapshot / `pg_dump`) + cutover + a tested drill log:**
  [RESTORE-RUNBOOK.md](RESTORE-RUNBOOK.md). The logical backup→restore path is
  **drill-verified** (120 rows dumped, dropped, restored, matched on 2026-06-19).
- **Prod DR knobs** are Terraform vars (`rds_multi_az`, `rds_deletion_protection`,
  `rds_skip_final_snapshot`) — safe demo defaults, one flip for production.

---

## 4. Required human actions (one-time)

1. **Rotate the eight leaked credentials.** Do NOT look for
   `scripts/purge-secrets.sh` — it was deleted, never ran, covered only 2 of the
   8 literals, and embedded two of them in plaintext. Rotation at the source
   system is the remediation; history rewriting is not. See
   [SECURITY-INCIDENT-2026-07.md](SECURITY-INCIDENT-2026-07.md) for the list and
   the current status.
2. **Make the five predecessor repositories private, then archive them.** They
   are still public as of 2026-08-01.
3. `terraform apply` with your AWS account.
4. Push to `kalanas210/durdans-lims` and set the repo variables above. (This is
   one repository now, not three — see [HISTORY.md](HISTORY.md).)

---

## 5. Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| App can't reach DB on host-run | Default DB port is **5434** (the LIMS DB); 5433 is the Keycloak DB. |
| Prometheus scrape 401 | Fixed — actuator is on internal port 11001; `/actuator/prometheus` is permitted there only. |
| `bitnami/kafka` pull fails | Replaced with `apache/kafka:3.8.1` (bitnami images were removed from Docker Hub). |
| Frontend image build fails on pnpm | The repo pins `pnpm@9.15.9`; keep a single `pnpm-lock.yaml` (no `package-lock.json`). |
| Container name conflict on `up` | A stale container holds the name — `docker compose down --remove-orphans` then `up`. |
