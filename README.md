# Durdans LIMS

Laboratory Information Management System for **Durdans Hospital, Sri Lanka**.
Built by a University of Moratuwa team in partnership with **IFS Sri Lanka**.

This is a monorepo: the web client, the backend service, the instrument
simulator, the infrastructure stack and the load tests all live here and are
versioned together, so a change that spans two of them is one commit and one
pull request.

---

## Repository layout

```
apps/
  frontend/                   Next.js 16 · React 19 · TypeScript · Tailwind · Keycloak-JS
  lims-core-service/          Spring Boot 3.5 · Java 21 · Gradle multi-module
  lims-instrument-simulator/  Emits synthetic analyzer results for the ingestion path
infra/                        docker-compose stack, Terraform, Keycloak realm, observability
load-testing/                 k6 scenarios
docs/                         Architecture, deployment, runbooks, reviews
tools/                        Developer helper scripts
```

`lims-core-service` is itself two Gradle modules: `lims-core-service-api`
(contracts) and `lims-core-service-app` (implementation).

---

## Running it locally

Requires Docker Desktop, JDK 21 and Node 22 with pnpm.

```bash
cd infra
cp .env.example .env      # then fill in real values — .env is git-ignored
docker compose up -d
```

That brings up the full stack:

| Service | Port | Notes |
| --- | --- | --- |
| Frontend | 3000 | Next.js |
| Core service API | 11000 | management port 11001 stays on the private network |
| Keycloak | 8081 | realm `lims-realm` |
| LIMS Postgres | 5434 | `durdans_lims_db` |
| Keycloak Postgres | 5433 | |
| Kafka | 9092 | |
| LocalStack (S3) | 4566 | |
| Prometheus | 9090 | |
| Alertmanager | 9093 | |
| Grafana | 3001 | |
| Tempo | 3200 | trace query API |

To run an app directly instead of in a container:

```bash
cd apps/lims-core-service && ./gradlew bootRun
cd apps/frontend && pnpm install && pnpm dev
```

---

## Clinical workflow

The system models the specimen lifecycle end to end:

```
patient registration → order + billing → phlebotomy (collection)
   → reception (accessioning) → MLT result entry → supervisor verification
   → pathologist clinical authorization → dispatch (email / SMS)
```

with audit logging, branch administration and super-admin layered across it.

**Roles:** `MLT`, `LAB_SUPERVISOR`, `LAB_RECEPTIONIST`, `phlebotomist`,
`billing`, `dispatch`, `BRANCH_ADMIN`, `SUPER_ADMIN`.

---

## Scope — what is and is not built

Stating this plainly so nobody has to reverse-engineer it from the code:

- **Real:** the clinical pipeline screens and their backend, authentication and
  role enforcement via Keycloak, audit logging, the transactional outbox,
  report dispatch, and the Liquibase-managed schema.
- **Partial:** super-admin and branch dashboards are UI built against mock data.
- **Not connected:** no physical analyzer is integrated. Instrument and QC data
  come from `lims-instrument-simulator` and static reference JSON. The ingestion
  endpoint it exercises is real; the device link is not.
- **Test coverage:** currently narrow — a small number of automated tests, not a
  suite that would justify calling the system verified.

---

## Development

```bash
tools/install-hooks.sh     # point git at the repo's shared hooks
```

CI is path-filtered — touching `apps/frontend/` runs the frontend workflow only.
The security workflow (secret scan, editor-autorun check, commit hygiene) runs on
every change regardless of path.

Read [SECURITY.md](SECURITY.md) before committing anything that touches
credentials or configuration.

---

## History

This repository was created on 2026-07-31 by consolidating five separate
repositories. Their full per-file history is preserved in the archived originals
— see [docs/HISTORY.md](docs/HISTORY.md) for the archive links and final commit
SHAs, and [CONTRIBUTORS.md](CONTRIBUTORS.md) for who built what.
