# Durdans LIMS — Enterprise Review & Implementation Plan

> Architecture review in the style of an IFS / Sysco LABS / WSO2 senior-engineer
> assessment. Full scan of `frontend`, `lims-core-service` (api + app), and
> `lims-infrastructure`: 216 Java files, ~130 frontend files, 17 Liquibase
> changelogs.
>
> **Date:** 2026-05-30 · **Status:** review complete, remediation not started ·
> **Audience:** Durdans LIMS team + IFS reviewers

Companion documents:
- `PHASE-0-REMEDIATION-BACKLOG.md` — actionable P0 tickets (file:line + acceptance criteria)
- `instrument-integration-design.md` — device layer design
- `../lims-instrument-simulator/` — working ASTM analyzer simulator (the "dummy machine data")

---

## 1. Executive summary

You have built an impressive student MVP with a **real, working clinical
pipeline**: patient → order/billing → phlebotomy → accessioning → MLT result
entry → supervisor verification → pathologist authorization → dispatch, plus
audit. Several operational screens (accessioning checklist, MLT result entry with
delta-checks, two-step clinical sign-off, bulk-approval safety rules) are better
than some commercial products.

It is **not yet enterprise-ready**, and an IFS tech lead would block it at review
for a small number of concrete, serious reasons:

| # | Blocker | Severity |
|---|---------|:--------:|
| 1 | **Live secrets committed to Git** — DB password (`‹redacted-db-password›`) + working Gmail app password (`‹redacted-mail-app-password›`) in `application.yml` | 🔴 Critical |
| 2 | **Broken multi-tenancy** — patient/order/bill/sample/stats queries not branch-scoped; Branch A can read Branch B's patient PHI + financials (IDOR) | 🔴 Critical |
| 3 | **Public unauthenticated `/test/email`** = open mail relay; `/actuator/**`,`/test/**` are `permitAll` | 🔴 Critical |
| 4 | **Lossy eventing** — Kafka publish inside domain transactions, no outbox, non-idempotent consumer, no DLQ | 🟠 High |
| 5 | **`bulkVerify` reports false success** — self-invocation defeats `@Transactional`; batch rolls back while API says VERIFIED | 🟠 High |
| 6 | **Critical-value flags clinically wrong** — faked as ±30% of reference range | 🟠 High |
| 7 | **Admin layer is mock theater** — Super-Admin + Branch dashboards (users, roles, security, 2FA, monitoring) save nothing while looking live | 🟠 High |
| 8 | **~7 tests / 216 Java files; no CI/CD; no observability; no instrument layer** | 🟠 High |

### Scorecard

| Area | Grade | Note |
|------|:-----:|------|
| Clinical workflow design | A− | The lab pipeline is well thought through |
| Frontend operational UX | B+ | Accessioning, result-entry, clinical sign-off are strong |
| Money/billing correctness | B | BigDecimal + optimistic locking done right |
| Security & secrets | D | Committed credentials, open endpoints, broken tenant isolation |
| Multi-tenancy / RBAC depth | D+ | Correct in 2 of ~8 modules |
| Eventing & integration | C− | Kafka-in-domain, no outbox/DLQ; self-calling HTTP |
| Data model (lab depth) | C | Demo-grade catalog; no age/sex ranges, critical values, LOINC |
| Admin (branch/super) | D | Mostly non-functional mock UI |
| Testing / CI / observability | D− | ~7 tests, no pipeline, no metrics/tracing |
| Instrument integration / QC | F (absent) | Static JSON pretending to be analyzers |

---

## 2. Current-state architecture

```
frontend (Next.js 16 App Router, React 19, TS, Tailwind, Keycloak-JS)
  ~88% "use client" SPA · 1,246-line api.ts · clinical pipeline REAL,
  super-admin/branch dashboards MOCK
        │ REST + JWT (Keycloak realm_access roles)
lims-core-service (Spring Boot 3.5 / Java 21) — single deployable
  -api (DTOs/enums/validators) + -app (fat: web+service+JPA+kafka+s3+mail)
  ⚠ self-HTTP-call PatientClientService → localhost:11000
  ⚠ Kafka publish inside domain txns (no outbox) · instruments = static JSON
        │ JPA/Liquibase     │ Kafka (in-proc)   │ S3/SMTP
  PostgreSQL durdans_lims_db │ (not in compose!) │ LocalStack + Gmail
lims-infrastructure: docker-compose = Keycloak + 2× Postgres only
  (Kafka, LocalStack, the app, observability — all absent)
```

Structural issues a reviewer raises immediately:
- The `-api`/`-app` split is cosmetic; `-app` is a fat module with no enforced layering.
- **Distributed monolith** — the service HTTP-calls itself (`PatientClientService`), forwarding the user's bearer token, swallowing failures to `null`.
- **Events-as-afterthought** — in-process Kafka with no infra to run it, no outbox, no DLQ.

---

## 3. All findings (prioritized)

Severity: 🔴 Critical · 🟠 High · 🟡 Medium · ⚪ Low.

### 3.1 Security & secrets
| Sev | Finding | Location |
|----|---------|----------|
| 🔴 | Live DB + Gmail credentials committed | `application.yml:11-12,47-48` |
| 🔴 | Open mail relay — unauthenticated `GET /test/email` | `TestController.java:25-29`, `SecurityConfig.java:33` |
| 🔴 | Broken tenant isolation (IDOR) — patient/order/bill/sample/stats not branch-scoped; client `branchCode` trusted | `PatientService.java:122-148`, `OrderService.java:270-279`, `MltTestingService.java:379` |
| 🟠 | `/actuator/**` permitAll — latent `/env`,`/heapdump` leak | `SecurityConfig.java:32` |
| 🟠 | Two divergent `SecurityUtils` (static has `getCurrentBranchId`, bean does not) — root cause of the isolation gap | `security/SecurityUtils.java` vs `util/SecurityUtils.java` |
| 🟠 | Generic exception handler leaks `ex.getMessage()` (SQL/constraint/stack); two error shapes | `GlobalExceptionHandler.java:66,80,209-220` |
| 🟡 | `BR001` magic branch string overwrites legitimate branch; CORS hardcoded; PII/OTP in logs; audit IP hardcoded `0.0.0.0` | `PatientService.java:84`, `SecurityConfig.java:81-99`, `MockSmsService.java:13-16`, `PatientController.java:33…` |

### 3.2 Eventing / integration (the Kafka-in-patient concern)
| Sev | Finding | Location |
|----|---------|----------|
| 🟠 | No transactional outbox — AFTER_COMMIT send loses events on broker outage | `PatientKafkaEventListener.java`, `DispatchService.java`, `KafkaConfig.java:38-40` |
| 🟠 | Consumer not idempotent, auto-commit on, no DLQ | `KafkaConfig.java:58`, `LabReportAuthorizedKafkaListener.java` |
| 🟠 | Distributed monolith — service HTTP-calls itself, no RestTemplate timeouts, N+1 inside txns, failures swallowed | `PatientClientService.java:27-45`, `RestTemplateConfig.java:11-14` |
| 🟡 | Unbounded `@Async` (`SimpleAsyncTaskExecutor`); dead `PatientEvent`, dead `ClinicalReportAuthorizedDispatchListener` | `LimsApplication.java`, `event/*` |

**Principle:** domain services should publish domain events to the in-process bus
(they do, via `ApplicationEventPublisher` — good). Whether those go to Kafka is
**infrastructure**, behind a **transactional outbox** owned by a relay, not by
`PatientService`. The outbox is what makes a future service split safe.

### 3.3 Business-logic correctness
| Sev | Finding | Location |
|----|---------|----------|
| 🔴 | Email/SMS sent inside DB transactions — 30s SMTP pins a connection; failure rolls back registration/dispatch; report emailed before commit then rolled back | `PatientService.java:92,331,483,531`, `DispatchService.java:224-310` |
| 🟠 | `bulkVerify` false success — `this.verifyResult()` ignores `@Transactional`; batch rollback while API returns VERIFIED | `VerificationService.java:447-466` |
| 🟠 | Critical-value flags faked at ±30% of reference range; feeds auto-bulk-approval | `MltTestingService.java:517-556` |
| 🟡 | Reject stamps "technically verified by/at" (false provenance); "return to MLT" routes to supervisor; writes inside GET endpoints; discount reason discarded; no segregation of duties; leftover `OTP_EXPIRED_DEBUG`; optimistic-lock for stale forms commented out | `VerificationService.java:431-438`, `ClinicalAuthorizationService.java:262-295`, `OrderService.java:824-880`, `BillingService.java:85-117`, `PatientService.java:285-288,548-565` |
| ⚪ | Hardcoded `"+12% vs yesterday"`; `overduePayments` = `pendingPayments`; documented hourly overdue job doesn't exist | `PatientService.java:382`, `StatisticsService.java:92`, `SchedulingConfig.java` |

### 3.4 Performance (N+1 / in-memory scans)
| Sev | Finding | Location |
|----|---------|----------|
| 🟠 | N+1 HTTP patient lookups per row inside list transactions (timeout-less RestTemplate) | `OrderService`, `BillingService`, `SampleService.getPatientSafely` |
| 🟠 | Loads entire patient table into memory | `MltTestingService.java:379` |
| 🟠 | Loads all pending samples twice + in-memory filter, ignoring existing count queries | `StatisticsService.java:108-146` vs `SampleRepository:43,49` |
| 🟠 | N+1 S3 presigned-URL generation per patient on every search page | `PatientService.java:603-633` |

### 3.5 Data model & migrations
| Sev | Finding | Location |
|----|---------|----------|
| 🔴 | Duplicate `rejection_notes` changeset (not in master) — hard startup failure once included | `20260503120000_add_sample_rejection_notes.xml` |
| 🔴 | Order→Patient has no FK + type mismatch (`varchar(50)` vs `UUID`); same for OrderItem/Test/Result | `OrderEntity.java:34` |
| 🔴 | Soft-delete not enforced globally — deleted patients leak; unique phone/NIC counts deleted rows → blocks re-registration | `BaseEntity.java:41` |
| 🟠 | `audit_log` has zero indexes; patient search columns unindexed; `version`/`is_deleted` added nullable (disables locking); timezone chaos (`Instant` vs `LocalDateTime`, `timestamptz` vs `timestamp`); audit not tamper-evident | various migrations |
| 🟠 | Catalog too thin — single `[low,high]` (no sex/age), no critical limits in data, no LOINC/UCUM, free-text result column, no panel→component/reflex/method/instrument | `TestParameterEntity`, `TestResultEntity:32` |

### 3.6 Frontend correctness & architecture
| Sev | Finding | Location |
|----|---------|----------|
| 🔴 | Route protection browser-only (no `middleware.ts`); page code ships before guard resolves | `(protected)/layout.tsx`, `RoleGuard.tsx` |
| 🔴 | `RoleGuard` fails OPEN on error/empty roles | `RoleGuard.tsx:47-49,78-83` |
| 🔴 | Token refresh leaks timer + logs out on any blip | `AuthProvider.tsx:25-29` |
| 🔴 | `keycloak as Keycloak` non-null cast → NPE in `useAuth` | `keycloak.ts:10-12`, `useAuth.ts` |
| 🟠 | Admin layer mock theater — superadmin/* + branch dashboard hardcoded; user-create/save handlers `console.log`; security/MFA toggles persist nothing | `superadmin/**`, `branch/page.tsx`, `admin/UserCreateModal.tsx` |
| 🟠 | `api.ts` 1,246-line monolith; inconsistent unwrapping; `getPatientById` splits name on spaces; axios no timeout/retry, logs out on any 401, swallows 403 | `lib/api.ts`, `lib/axios.ts:4-32` |
| 🟠 | `criticalCount == abnormalCount` on the sign-off screen; bulk verify has no confirm dialog | `verification/review/[sampleId]/page.tsx:157-158`, `verification/bulk-approval/page.tsx` |
| 🟡 | 59/67 pages `"use client"`; client-side pagination over full datasets; 84 `console.*`; 13 `alert()`; two toast libs; empty `next.config.ts`; dead duplicate mock/types; 11 copy-pasted sidebars | widespread |

### 3.7 Testing / CI / observability
- ~7 test files / 216 Java sources; lossy eventing, money flows, state machine untested; no Testcontainers.
- No CI/CD, no quality gates (lint/coverage/SAST/dependency+secret scanning — would have caught blocker #1).
- No actuator/health, no metrics, no tracing/correlation IDs; unstructured logs with PII.
- Kafka + LocalStack referenced in code/README but absent from `docker-compose.yml`; app not containerized; no IaC.

---

## 4. Missing lab capabilities (gap analysis)

Benchmarked against ISO 15189 / CAP / CLIA and standard LIS feature sets. The
clerical spine exists; the **analytical core of a clinical lab is largely absent.**

| # | Missing capability | Current |
|---|--------------------|:------:|
| 1 | Instrument integration (ASTM/HL7, host-query, driver-per-analyzer) | Absent (static JSON) |
| 2 | QC module — Westgard rules, Levey-Jennings, QC lots/levels | Absent |
| 3 | Autoverification rules engine (CLSI AUTO10/15) | Absent |
| 4 | Reference ranges by age/sex/condition + auto flagging | Single [low,high] |
| 5 | Critical-value workflow with read-back + documented notification | Faked at ±30% |
| 6 | LOINC-coded test compendium + UCUM units | Free-text strings |
| 7 | HL7 v2 interface to hospital HIS (ADT/ORM/ORU) + FHIR path | Absent |
| 8 | Delta checks | UI-only ≥40% |
| 9 | Result amendment/correction workflow (prelim↔final, versioned) | Overwrites in place |
| 10 | Reflex testing rules | Absent |
| 11 | Microbiology (organism ID, AST S/I/R, antibiograms) | Absent |
| 12 | Reagent/QC lot & inventory management | Absent |
| 13 | TAT monitoring & analytics | Absent |
| 14 | Calculated/derived results + unit conversions | Absent |
| 15 | Cumulative/trend reports + accreditation-grade PDF | Email/SMS only |
| 16 | Analytical worklists per bench/instrument | Partial |
| 17 | Histopathology (block/slide accessioning, synoptic reporting) | Absent |
| 18 | Sri Lanka PDPA pack (consent, DSR, retention, breach, DPIA) | Absent |
| 19 | Formal e-signatures (21 CFR Part 11-style) on verify/authorize | Weak |
| 20 | Chain-of-custody, storage/retention, add-on tests, POCT, insurance/claims, analyzer maintenance/calibration logs, backup/DR | Absent |

*Standards: IHE LTW/LAW, ASTM E1394/LIS2-A2, LOINC, Westgard, ISO 15189:2022,
Sri Lanka PDPA Act No. 9 of 2022 (health data = "special category"). Verify exact
CAP checklist numbers and the post-repeal PDPA enforcement date against current
SLAB/DPA sources before formal compliance planning.*

---

## 5. UI/UX problems for lab use

Top problems (ranked):
1. **Super-Admin + Branch dashboards are static mocks presenting as live** — worst is `superadmin/security` (Keycloak URL/secret, MFA, password policy that save nothing).
2. **MLT result entry isn't keyboard-first, no batch entry** — plain text inputs, no `inputMode="decimal"`, no Enter/Tab flow; the #1 efficiency miss for the highest-volume role.
3. **No worklist auto-refreshes** — STAT samples + verification/dispatch queues need polling/SSE.
4. **11 copy-pasted sidebars; a good shared component library (`StatCard`,`Pagination`,`StatusBadge`,`PriorityBadge`,`TubeIndicator`) bypassed and re-implemented inline.**
5. **Bulk verification mass-releases with no confirm; `criticalCount` bug** shows wrong totals on sign-off.
6. **`alert()` for validation/errors** across order/payment/phlebotomy/bulk-approval.
7. **Patient search omits age/sex/DOB, no pagination** — misidentification risk.
8. Critical/abnormal signaling is tint+text only — add a row icon; sub-11px clinical metadata.
9. Dead mock-bound components (`components/mlt/*`, phlebotomy/reception rows) mislead + bloat.
10. Decorative no-op buttons (dispatch "Filter", branch "Download CSV"); invisible super-admin revenue bars.

Strengths to preserve: accessioning checklist with Accept-gating; MLT delta-check + flag tinting + read-only-after-submit; clinical two-step signature modal with plain-language critical summary; bulk-approval "only NORMAL is safe" rules; phlebotomy wait-time escalation + label print audit.

---

## 6. Target architecture

Evolve to a **modular monolith with clean bounded contexts first**, then carve out
services along proven seams (the pragmatic WSO2/Sysco path — don't jump to
microservices for a student team, but make the seams real).

Bounded contexts (start as modules; each owns its tables + outbox):
1. **Identity & Access** — Keycloak + thin admin service (user/role/branch via Keycloak Admin API). *This is where Super-Admin and Branch-Admin user management lives.*
2. **Patient / MPI** — registration, verification, documents, dedup.
3. **Order & Billing** — orders, bills, payments, discounts/approvals.
4. **Lab Workflow** — sample lifecycle as an explicit, guarded state machine.
5. **Results & QC** — result model (numeric/qualitative/calculated), reference ranges, critical values, autoverification/delta/reflex, Westgard QC.
6. **Instrument Integration (middleware)** — ASTM/HL7 drivers, host-query, the simulator. Isolated so a hung analyzer never touches the core DB.
7. **Notification & Dispatch** — channels, PDF rendering, versioning, delivery tracking, retries.
8. **Reporting & Interoperability** — cumulative/trend reports, HL7/FHIR gateway, portals.

Cross-cutting: API gateway, transactional outbox + Kafka + schema registry + DLQ,
OpenTelemetry, centralized config + Vault secrets, and a **single enforced
tenant-isolation filter** so no query can leak across branches.

---

## 7. Branch Admin & Super Admin (explicitly in scope)

Today both are mostly non-functional mock UI; the backend has **no** user/branch/role
management (no `UserController`, no Keycloak Admin integration). Define them as
real features.

**Super Admin (organization-wide):**
- User lifecycle across all branches via **Keycloak Admin API** (server-side service, not the mock modal); assign roles + home branch.
- Role & permission management (back the existing matrix UI with real definitions).
- Branch management — CRUD (replace migration-managed seed), activate/deactivate, assign branch admins.
- Master data — test catalog (LOINC), reference ranges by age/sex, critical limits, reflex/autoverification rules, reagent catalog, report templates, dispatch channels.
- System config & security policy — password/MFA policy (applied in Keycloak), session limits, billing thresholds.
- Monitoring & ops — real health (actuator), Kafka/consumer lag, instrument/middleware status, integration message logs, DLQ viewer.
- Global reports & audit — cross-branch revenue/TAT/volume; tamper-evident audit search/export.
- Compliance — PDPA data-subject-request handling, retention policy, consent records.

**Branch Admin (scoped to their branch, enforced — see blocker #2):**
- Branch user management within their branch only.
- Branch dashboard with **real** KPIs (registrations, orders, revenue, TAT, pending verifications, STAT backlog) — replace hardcoded `branch/page.tsx`.
- Branch operational reports & activity logs (build on the already-real users/activity views).
- Branch-level config within Super-Admin guardrails.
- **Hard rule:** every branch-admin query filtered by the JWT branch server-side; only Super Admin crosses branches.

---

## 8. Phased roadmap

Sequenced the way IFS/Sysco/WSO2 would run it: **stabilize and make it safe before
adding features.** Durations are relative, assume a small student team.

### Phase 0 — Stabilize & secure (P0 blockers) · ~2–3 wks · *do first*
Rotate + purge leaked secrets, externalize config, add secret scanning. Delete
`/test/**`, lock down `/actuator/**`. Fix tenant isolation (unify `SecurityUtils`,
Hibernate tenant filter, branch-scope all queries). Frontend `middleware.ts`,
fail-closed `RoleGuard`, fix token refresh + null safety. Stand up CI/CD + full
`docker-compose` + containerize. Actuator + OpenTelemetry + structured logging
baseline. **Exit:** no secrets in repo, no cross-branch leakage, green pipeline,
health/trace live. → see `PHASE-0-REMEDIATION-BACKLOG.md`.

### Phase 1 — Architecture foundation · ~3–4 wks
Refactor `-app` into bounded-context modules; delete self-HTTP `PatientClientService`.
Transactional outbox + idempotent, manually-committed, DLQ-backed consumers (or
drop Kafka to in-process until a real split). Move email/SMS/dispatch I/O to
AFTER_COMMIT async (bounded executor). Fix correctness bugs (bulkVerify, writes-in-GET,
reject provenance, return-to-MLT, discount persistence, segregation of duties).
Testcontainers + integration tests for money + state machine + outbox.

### Phase 2 — Lab data-model depth · ~3–4 wks
Catalog redesign: panels→components, LOINC/UCUM, `result_data_type`, numeric
result column, reference ranges by age/sex/condition, `critical_low/high`. Add FKs
(Order→Patient, OrderItem→Test, branch FK), `@SQLRestriction` soft-delete + partial
unique indexes, missing indexes, `timestamptz` standardization, tamper-evident
audit. Replace ±30% critical logic with real limits; delta-check + reflex engines.
Result amendment/correction workflow (prelim↔final, versioned).

### Phase 3 — Instrument integration + simulator · ~3–4 wks
Build the Instrument-Integration middleware (driver-per-analyzer, host-query, raw
message log, outbox publish). The Analyzer Simulator already exists
(`lims-instrument-simulator/`, ASTM LIS2-A2, FBC + U&E). **Exit:** demo where a
sample pulls the order, the simulator returns results, and they flow through
autoverification into the worklist.

### Phase 4 — QC + autoverification · ~2–3 wks
QC module (Westgard, Levey-Jennings, lots/levels, lot→result linkage); replace the
static `qc-dashboard`. Autoverification rules engine (flag/QC/delta/reflex/critical
→ auto-release or hold); critical-value read-back capture.

### Phase 5 — Admin (Branch + Super) · ~3–4 wks
Keycloak Admin API integration service; wire all real admin UIs. Branch CRUD,
role/permission management, master-data editors, real config + security policy.
Real branch + global dashboards, monitoring (consumer lag, DLQ, instrument status),
tamper-evident audit search/export.

### Phase 6 — Reporting & interoperability · ~3–4 wks
Accreditation-grade PDF reports (units + reference interval + flags per line),
cumulative/trend, versioning. HL7 v2 gateway to HIS (ADT/ORM/ORU), FHIR groundwork,
patient/physician portals.

### Phase 7 — Compliance & accreditation · ~2–3 wks + ongoing
PDPA pack (consent, DSR, retention, breach, DPIA), e-signatures (Part 11-style),
backup/DR, reagent/inventory lot tracking, TAT SLAs, ISO 15189 gap checklist,
chain-of-custody, analyzer maintenance/calibration logs.

### Engineering practices throughout (what IFS actually grades)
Trunk-based/GitFlow with PR reviews + required checks; ADRs for key decisions; test
pyramid (unit + Testcontainers + contract/consumer-driven + a few Playwright E2E);
Definition of Done (tests, no new `console.*`/`any`, security-reviewed, observable,
docs updated); dev/stage/prod with IaC; no secrets in code (CI gate). Frontend:
consolidate the 11 sidebars to one config-driven component, adopt the shared library,
TanStack Query for data/cache/realtime, server-first RSC for read-heavy pages,
replace `alert()` with toasts, add CSP/security headers.

---

## 9. What's already delivered alongside this review

- **`../lims-instrument-simulator/`** — a runnable ASTM E1394/LIS2-A2 analyzer
  simulator (the "dummy machine data"). Verified end-to-end: emits FBC and
  Urea/Electrolyte results with normal/abnormal/critical flags over the real
  protocol; a bundled host receiver decodes and validates every frame.
- **`instrument-integration-design.md`** — how the middleware consumes it.
- **`PHASE-0-REMEDIATION-BACKLOG.md`** — the P0 fix tickets.
