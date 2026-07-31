# Durdans Hospital LIMS — Consolidated Production-Readiness Roadmap

> **Prepared for:** IFS Sri Lanka senior-engineer review
> **Date:** 2026-06-19 · **Method:** 8 parallel code auditors over the live
> `enterprise-hardening` branches + senior synthesis (not the 19-day-old notes —
> every claim re-verified against the code on disk).
> **Scope:** `lims-core-service` (Spring Boot 3.5 / Java 21), `frontend`
> (Next.js 16 / React 19), `lims-infrastructure` (compose stack),
> `lims-instrument-simulator`.

**Verdict in one line:** A genuinely strong clinical-workflow MVP with mature
error-handling instincts and real progress on tenant isolation and critical-value
logic — but **not yet safe to run a real accredited lab**, and several blockers
(leaked secrets in git history, no backup/DR, no tamper-evident audit, no result
versioning, no critical-value callback) will be the first things a senior reviewer
flags.

The single most important framing: **the safe code is well-tested and the
dangerous code is untested.** Validators and parsers have unit tests;
`VerificationService`, tenant isolation, and authorization have ~0% coverage.
Fixing that inversion is the spine of this plan.

---

## 0. The "must be true before the review" shortlist

Five things, in order, that turn a "promising student project" into "this person
understands enterprise software":

1. **Purge leaked credentials from git history and rotate them** (recoverable in
   4 commits *and* re-published in `SECURITY.md`).
2. **One-command full-stack bring-up** — `docker compose up` currently starts only
   the 7 backing services; app + frontend are host-run, and the default DB port
   points at the *wrong* Postgres (Keycloak's DB on 5433, not the LIMS DB on 5434).
3. **A demonstrable backup + restore drill** (even single-node `pg_dump` + a
   documented restore closes 80% of the concern).
4. **Integration tests on the 3 clinical-safety paths** (verification, tenant
   isolation, authorization) using Testcontainers.
5. **A working, deployed AWS environment** reachable by URL, built and pushed by CI.

---

## 1. Workstreams — prioritized backlog

Severity = blocking weight. Effort = S(<1d) / M(1–3d) / L(>3d). "Serves" = which
of the 8 asks (1 review/fix · 2 containerize · 3 CI/CD+AWS · 4 new tech ·
5 DevOps · 6 testing · 7 error-handling · 8 prod-readiness).

### Workstream A — Security & Secrets (do first, blocks everything)

| # | Task | Sev | Eff | Serves |
|---|------|-----|-----|--------|
| A1 | Rotate the leaked Postgres (`‹redacted-db-password›`) + Gmail app password (`‹redacted-mail-app-password›`) **now** — treat as compromised | P0 | S | 1,8 |
| A2 | `git filter-repo`/BFG across all 3 repos to purge `application.yml` history; force-push; everyone re-clones | P0 | M | 1,5 |
| A3 | Delete plaintext secrets from `SECURITY.md`; reference as "rotated, in Secrets Manager" | P0 | S | 1,8 |
| A4 | Move all secrets to env / AWS Secrets Manager; commit `.env.example`; gitignore `.env` | P1 | S | 1,3,8 |
| A5 | Field-level encryption for PHI (NIC, phone, DOB, address) via JPA `AttributeConverter` + pgcrypto; encrypted RDS storage | P1 | L | 1,8 |

### Workstream B — Containerization (ask #2)

| # | Task | Sev | Eff | Serves |
|---|------|-----|-----|--------|
| B1 | Fix DB port bug: app default `5433` hits the **Keycloak** DB, not the LIMS DB (`5434`) | P0 | S | 2,8 |
| B2 | Add `app` + **new** `frontend` to compose; wire env to in-network DNS, not `localhost` | P0 | L | 2,3,8 |
| B3 | Frontend: `output: 'standalone'`, multi-stage Dockerfile + `.dockerignore` | P0 | S | 2,3 |
| B4 | Layered Spring Boot jar + BuildKit gradle cache mount | P1 | M | 2,5 |
| B5 | Pin base images to patch tag + digest | P1 | S | 2,8 |
| B6 | Healthchecks on every service + `depends_on: condition: service_healthy` | P1 | M | 2,5,8 |
| B7 | `HEALTHCHECK` wired to actuator liveness/readiness | P2 | S | 2,8 |
| B8 | Named volumes for Prometheus TSDB + Grafana; explicit network; mem/cpu limits | P2 | M | 2,5 |
| B9 | git-init the instrument-simulator + give it a Dockerfile | P3 | S | 2,5 |

### Workstream C — CI/CD (ask #3, #5)

| # | Task | Sev | Eff | Serves |
|---|------|-----|-----|--------|
| C1 | Fix triggers: CI runs only on `develop`/`main` but all work is on `enterprise-hardening` → the branch under review gets **zero** CI | P1 | S | 3,5 |
| C2 | Build + push backend image to registry, tagged `:sha`/`:branch`/`:semver` | P0 | M | 3,5 |
| C3 | Frontend CI: `lint`, `tsc --noEmit`, `next build`, image build/push | P0 | M | 3,5,6 |
| C4 | Deploy job with GitHub Environments + OIDC role assumption (no static keys), prod approval gate | P0 | L | 3,5 |
| C5 | Trivy image + fs scan (fail on HIGH/CRITICAL); Dependabot for gradle/npm/docker/actions | P1 | M | 3,5,8 |
| C6 | gitleaks full-history scan; keep CodeQL | P1 | S | 1,3,5 |
| C7 | SBOM (Syft/CycloneDX) + cosign image signing | P2 | M | 3,5,8 |
| C8 | Spotless/Checkstyle gate; branch protection requiring gates before merge | P3 | S | 5,8 |

### Workstream D — IaC / AWS (ask #3, #4)

| # | Task | Sev | Eff | Serves |
|---|------|-----|-----|--------|
| D1 | Terraform skeleton: VPC, subnets, SG, ECR, RDS, compute, Secrets Manager, S3, remote state (S3+DynamoDB lock) | P1 | L | 3,4,5 |
| D2 | Provision the recommended architecture (§2) + wire CI deploy to it | P0 | L | 3,5,8 |
| D3 | RDS automated backups + PITR; documented RPO/RTO; tested restore runbook | P0 | M | 3,8 |
| D4 | Real S3 bucket (replace LocalStack in deployed env), SSE + least-privilege IAM task role | P1 | M | 3,8 |

### Workstream E — Testing (ask #6)

| # | Task | Sev | Eff | Serves |
|---|------|-----|-----|--------|
| E1 | Testcontainers + Postgres harness (singleton container, `application-test.yml`, Liquibase applies) — **unblocks all DB-backed tests** | P0 | L | 6,8 |
| E2 | Integration tests for the 3 P0 clinical paths (verify → reportable + audit + REQUIRES_NEW; authorize; auto-verify HOLD on CRITICAL blocks reporting) | P0 | L | 6,8 |
| E3 | **Tenant-isolation integration test**: branch-A JWT cannot read/write branch-B data | P0 | M | 6,8 |
| E4 | `@WebMvcTest` slices for every `@PreAuthorize` controller (401/403/200) | P1 | M | 6,8 |
| E5 | k6 load tests (auth → order → result → verify), p95/p99/RPS/error-rate as artifacts | P1 | M | 6,8 |
| E6 | Outbox/dispatch reliability tests (at-least-once drain, idempotent redelivery) | P1 | M | 6,8 |
| E7 | `InstrumentResultIngestionService` end-to-end (ASTM/HL7 → persisted result + flags + queue) | P1 | M | 6,8 |
| E8 | `BillingService` charge-calc + bill-state tests | P1 | M | 6,8 |
| E9 | Frontend: Vitest+RTL (RoleGuard/AuthProvider/api mappers) + Playwright e2e | P1 | L | 6,8 |
| E10 | JaCoCo coverage gate, ratcheting, targeted at the service package | P2 | S | 6,8 |

### Workstream F — Error-handling & Resilience (ask #7)

| # | Task | Sev | Eff | Serves |
|---|------|-----|-----|--------|
| F1 | Move blocking S3 I/O **out of** `@Transactional` in `PatientService.updateProfilePhoto` | P1 | M | 7,8 |
| F2 | Resilience4j `@Retry`+`@CircuitBreaker`+`@TimeLimiter` on S3/SMTP/HTTP; breaker state → Prometheus | P1 | M | 4,7,8 |
| F3 | `GlobalExceptionHandler` → RFC 7807 `ProblemDetail`; one shared shape incl. correlationId/errorCode | P2 | M | 7,8 |
| F4 | `@Valid` on the unvalidated QC-run body | P2 | S | 7 |
| F5 | Kafka producer `acks=all` + `enable.idempotence=true` + retries | P2 | S | 7,8 |
| F6 | Pin `server.error.include-stacktrace/message: never`; test asserts no `trace` leak | P3 | S | 7,8 |
| F7 | Frontend: central Axios error normalization + `error.tsx`/`global-error.tsx`/`not-found.tsx`; wire the dead 403 TODO | P1 | M | 7,8 |
| F8 | Remove the silent `localStorage` "fake success" fallback in supplies CRUD | P2 | M | 7,8 |

### Workstream G — Observability (ask #5, #8)

| # | Task | Sev | Eff | Serves |
|---|------|-----|-----|--------|
| G1 | **Unbreak metrics**: Prometheus scrape gets 401 (actuator SUPER_ADMIN-locked) → move to an internal `management.server.port` | P0 | S | 5,8 |
| G2 | Alertmanager + rules: **outbox dead-letter > 0** (page), critical-result-SLA breach, dispatch lag, Kafka lag, 5xx/p99, JVM/DB-pool | P0 | L | 5,8 |
| G3 | Micrometer business metrics: criticals detected vs notified, dispatch attempts/failures, autoverify pass/hold, per-stage TAT | P1 | M | 5,8 |
| G4 | Structured JSON logging + per-package levels + PII redaction | P1 | M | 5,8 |
| G5 | Request correlation IDs via `OncePerRequestFilter`→MDC, propagated across the outbox boundary | P1 | M | 5,8 |
| G6 | OpenTelemetry / Micrometer Tracing → Tempo/Jaeger; HTTP→JPA→outbox→consumer→dispatch as one trace | P1 | L | 4,5,8 |
| G7 | Grafana provisioned as code (RED/USE + clinical-ops dashboard) | P2 | M | 5,8 |
| G8 | Gradle build-info + git-commit-id → `/actuator/info` | P3 | S | 5,8 |

### Workstream H — Clinical / Compliance Hardening (ask #8 — the differentiator)

| # | Task | Sev | Eff | Serves |
|---|------|-----|-----|--------|
| H1 | **Critical-value notification + read-back + acknowledgment + escalation** workflow | P0 | L | 8 |
| H2 | **Result amendment/versioning** (`test_result_amendment` table; never overwrite a released result) | P0 | L | 8 |
| H3 | **Tamper-evident audit**: per-row SHA-256 chained to `prev_hash`, REVOKE UPDATE/DELETE + trigger, indexes, chain-verify job | P0 | L | 8 |
| H4 | Real e-signature: re-auth at sign, hash of signed content bound to signer+reason, immutable | P1 | M | 8 |
| H5 | Backup/DR (overlaps D3): WAL archiving + nightly dump, RPO/RTO doc, tested restore, standby | P0 | L | 8 |
| H6 | Global branch-scope + soft-delete via Hibernate `@Filter`/`@SQLRestriction` (replace 28 hand-written checks) | P1 | L | 8 |
| H7 | Liquibase `<rollback>` blocks on all changesets | P1 | M | 8 |
| H8 | Complete PDPA right-of-access export (returns only an order count today) | P1 | M | 8 |
| H9 | URL-tier role matchers for billing/dispatch/authorization/admin; enforce Keycloak MFA for privileged roles | P2 | M | 8 |
| H10 | Finish or feature-flag the remaining mock/demo screens | P1 | L | 8 |

---

## 2. Recommended AWS target architecture (~US$120 credit budget)

### Decision: **single EC2 host running the compose stack**, fronted by managed RDS + S3.

| Option | Monthly cost | Verdict |
|--------|-------------|---------|
| **EKS** | Control plane $73/mo **alone** + nodes → ~$120+/mo | ✗ Eats the whole budget in one month. Over-engineered for one team. |
| **ECS Fargate** | ~$45–70/mo (tasks) + ALB ($16) + NAT ($32) + RDS | ◑ The "right" cloud-native answer, but NAT+ALB+per-task burns credits fast (~6–8 weeks). Ship it as the **documented production target**, don't run it 24/7. |
| **Single EC2 + docker-compose** | ~$20–35/mo all-in | ✓ **Recommended.** Fits the full review window, reuses the compose stack (zero rework), and is honestly defensible. |

```
Route 53 (optional) → EC2 t3.small (2 vCPU/2 GB, Elastic IP)
  docker compose: app · frontend · keycloak · kafka · prometheus · grafana
                  + Caddy/nginx reverse proxy → free Let's Encrypt TLS
        ├──▶ RDS PostgreSQL db.t4g.micro (single-AZ, 20 GB gp3, 7-day PITR, encrypted)
        ├──▶ S3 (patient docs, SSE-S3, versioned)
        └──▶ Secrets Manager (DB / mail / Keycloak admin)
```

| Service | Spec | Est. /mo |
|---|---|---|
| EC2 t3.small | on-demand, us-east-1 | ~$15 |
| EBS 30 GB gp3 | | ~$2.40 |
| RDS db.t4g.micro | single-AZ, 20 GB | ~$13–15 |
| S3 | <5 GB | ~$0.50 |
| Secrets Manager | 3 secrets | ~$1.20 |
| Transfer / EIP | light | ~$2 |
| **Total** | | **≈ $34/mo → ~3.5 months on $120** |

**Budget guardrails (say these to the reviewer — they signal cost-awareness):**
AWS Budget alert at $40/mo + $100 total · stop the EC2 instance when not demoing
(RDS keeps the data) · Graviton (`t4g`) RDS · single region (us-east-1).

**Why this reads as senior, not cheap:** ship the EC2 deployment **and** commit the
Terraform module + a documented ECS-Fargate production target (ALB, multi-AZ RDS,
autoscaling) you deliberately don't run 24/7. Working software + demonstrated
judgment is exactly what IFS reviewers test for.

---

## 3. New technologies to introduce

| Tech | Why |
|---|---|
| **Terraform** | Reproducible, reviewable AWS provisioning with remote state. |
| **Testcontainers** | Keystone — real Postgres/Kafka in tests unblocks every P0 clinical & isolation test. |
| **k6** | Scriptable load testing with p95/p99 + thresholds as CI artifacts — the "show load testing" evidence. |
| **Resilience4j** | Retry + circuit-breaker + time-limiter on S3/SMTP/HTTP. |
| **Trivy** | Image + dependency CVE scanning in CI for a PHI system. |
| **OpenTelemetry + Micrometer Tracing** | End-to-end trace across the async HTTP→outbox→Kafka→dispatch pipeline. |
| **logback JSON encoder** | Structured, aggregatable logs keyed by `patient_code`/`branch_code`. |
| **Spring `ProblemDetail` (RFC 7807)** | Standard error bodies instead of ad-hoc maps. |
| **Caddy** | Automatic Let's Encrypt TLS + reverse proxy in ~5 lines — free HTTPS without an ALB. |
| **Dependabot + cosign/Syft** | Automated dep updates + supply-chain attestation for medical software. |
| **JaCoCo** | Ratcheting coverage gate so the ~5.8% ratio cannot regress. |

---

## 4. Top 5 things a senior IFS reviewer will call out

1. **Live secrets in git history + re-published in `SECURITY.md`.** Credibility-killer; fix first.
2. **No backup / DR / RPO / RTO.** A disk failure loses all PHI — automatic fail.
3. **Test coverage inverted by risk.** ~5.8% LOC, zero integration tests, and the most dangerous code is the least tested.
4. **No tamper-evident audit + no result versioning.** ISO 15189 / CAP / 21 CFR Part 11 require both.
5. **The "containerized full stack" doesn't actually run as one.** `docker compose up` starts only backing services; the default DB port points at the wrong database.

### Top patient-safety risks
1. **No critical-value callback** — a flagged panic result can sit unseen with nobody notified.
2. **No result amendment versioning** — a corrected potassium silently overwrites the original.
3. **Untested verification/authorization path** — a bug could release wrong results, uncaught.
4. **Tenant isolation enforced per-query, not globally** — one forgotten query leaks cross-branch PHI.
5. **Outbox dead-letter is silent** — a dropped authorized-report event only logs; no metric, no page.

---

## 5. Recommended execution order

**Phase 0 — Stop the bleeding (1–2 days).** A1→A2→A3 · B1 (DB port) · C1/C6 (CI on
the real branch + full-history gitleaks) · G1 (unbreak Prometheus).

**Phase 1 — Make it run as one system (week 1).** B3→B2 (frontend Dockerfile +
app/frontend into compose) · B5→B6 (pin + healthchecks) · A4 (`.env.example`).

**Phase 2 — Testing harness + clinical-safety tests (weeks 1–2).** E1 → E2/E3 →
E4 → E5.

**Phase 3 — CI/CD + AWS (weeks 2–3).** C2/C3 → D1 → D2/D3 → C4 → C5 → D4.

**Phase 4 — Clinical/compliance hardening (weeks 3–4, highest differentiator).**
H1 → H2 → H3 → H4 → H6 → H7/H8.

**Phase 5 — Resilience, observability, frontend (parallelizable).** F1/F2 →
F3/F7 → G2–G7 → E9 → F8/H10.

---

*Two truths to carry into the review: fix the secrets-in-history and the
test-coverage inversion before anything cosmetic; and deploy to a single
deliberately-budgeted EC2 host while shipping the Terraform + ECS production plan
you chose not to run. Working software plus demonstrated judgment is what reads as
senior.*
