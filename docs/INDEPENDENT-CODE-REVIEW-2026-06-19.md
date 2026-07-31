# Durdans LIMS — Independent Deep Code & Business-Logic Review

**Date:** 2026-06-19
**Scope:** All three repos on branch `enterprise-hardening` (backend `lims-core-service`, `frontend`, `lims-infrastructure`), business-logic-first.
**Method:** 15 independent senior reviewers (one per domain), each reading the live code; each domain's findings then adversarially re-verified against the code by a second reviewer (refuted findings dropped, severities corrected); the leaked-secret, deploy-gate and OIDC-trust claims verified directly. ~2.5M tokens of analysis, 959 file reads/greps.
**Calibration:** scored against a real **commercial / regulated clinical-LIMS** bar (a system a hospital runs under CAP/ISO 15189/PDPA), **not** a student bar. A strong university capstone sits ~45–60 on this scale.

---

## 1. Verdict

> **Overall enterprise-readiness: 56 / 100 — "Approaching enterprise-grade engineering, not yet a shippable enterprise clinical system."**
>
> **Is it enterprise-level? → Qualified NO, on two different axes:**
> - **Engineering practice & infrastructure: ~7/10 — at or near enterprise level.** Transactional outbox, tamper-evident hash-chained audit, Testcontainers integration tests on the dangerous paths, multi-repo CI/CD (gitleaks + CodeQL + Trivy + keyless OIDC), Terraform with an *actually-executed* DR drill, and a full Prometheus/Alertmanager/Tempo/Grafana-as-code stack. This is well above student work and genuinely impressive.
> - **Clinical business-logic correctness & safety: ~5/10 — below the bar, with a cluster of true blockers.** Several confirmed CRITICAL defects (QC doesn't gate release, amendments don't re-trigger critical-value callbacks or re-dispatch, cross-branch write IDOR, live secrets in history) mean it **cannot be run as-is in a regulated lab.**

The foundation is enterprise-track. The gap is in the **domain logic and a handful of security blockers**, almost all of which are well-scoped and fixable. Close the P0 list below and it crosses into "qualified enterprise."

---

## 2. Scorecard (verifier-adjusted, /10)

| # | Domain | Score | One-line |
|---|--------|:----:|----------|
| 13 | Data Model, Migrations & Tamper-Evident Audit | **7.0** | Audit chain is commercial-grade; schema has real FK/soft-delete gaps |
| 15 | Enterprise Readiness (tests/CI/IaC/obs/ops) | **6.5** | Strong stack; disqualified operationally by live secrets + no deploy gate |
| 4 | MLT Results, Ranges & Flagging | **6.5** | Best clinical module; unit & pediatric-range gaps remain |
| 1 | Orders & Billing | **6.0** | Solid money math; no patient validation, no refund path |
| 8 | Critical-Value Notification & Escalation | **6.0** | Thoughtful lifecycle; no lock, single static recipient |
| 14 | Frontend Auth & Route Protection | **6.0** | Mature auth; large mock surface, forgeable edge cookie |
| 2 | Patient Management & PDPA | **5.5** | Good scaffolding; NIC validator unwired, write-path tenant holes |
| 3 | Phlebotomy / Sample / Accessioning | **5.5** | Race-safe barcodes; cross-branch write IDOR, no audit on hot paths |
| 6 | Clinical Authorization & E-signature | **5.0** | Right gates; cross-branch IDOR, cosmetic signature, no SoD |
| 7 | Dispatch & Notifications | **5.0** | Good txn discipline; stubs marked DELIVERED, no PDF, no idempotency |
| 9 | Instrument / Auto-verify / QC-Westgard | **5.0** | Strong ingestion; **QC is decorative**, partial-panel auto-verify |
| 10 | Result Amendment & Versioning | **5.0** | Immutable history; **safety wiring stops at the amendment boundary** |
| 11 | Multi-Tenancy / AuthZ / IDOR | **5.0** | Read paths fail-closed; **write paths systematically unscoped** |
| 12 | Transactions, Outbox & Eventing | **5.0** | Outbox core solid; durability config dropped, pipeline inert |
| 5 | Supervisor Verification (bulkVerify) | **4.0** | REQUIRES_NEW done right; no SoD, unscoped mutation + worklist |

Unweighted mean ≈ 5.6/10. Weighting the clinical-safety + tenant-isolation domains more heavily (as a regulated LIMS must) lands the composite at **56/100**.

---

## 3. CRITICAL findings (confirmed — production blockers)

1. **QC failure does not block patient result release — QC is decorative.**
   `TestResultMapper.java:42` hardcodes `qcStatus("Not Linked")`; neither `AutoverificationService` nor `InstrumentResultIngestionService` consults `QcService`/`WestgardEvaluator`. A failed Westgard control does not hold, block, or even flag patient results from the same run. *This is the single most important QC invariant in a clinical LIMS, and it is absent.*

2. **Amending a result into a new critical value raises no critical-value callback.**
   `ResultAmendmentService` never injects `CriticalValueNotificationService`; `openForResult` is called only from result-entry and instrument ingestion (`ResultAmendmentService.java:118-142`). A potassium typo corrected 4.5→7.5 mmol/L produces no clinician call, no escalation, no read-back.

3. **Corrected report is never re-generated or re-dispatched after amendment.**
   For a DISPATCHED result, amendment writes only an audit line (`ResultAmendmentService.java:133-139`) — no dispatch event. The patient/clinician keeps the wrong report; the "corrected report must be re-issued" promise is logged, not implemented.

4. **Cross-branch write IDOR across the clinical pipeline.** Read paths are branch-scoped and fail closed, but the high-value *write* paths load by UUID and mutate with **no** branch check:
   - `SampleService.collectSample`/`rejectSample` (`:208`/`:260`) — collect/reject another branch's specimen.
   - `VerificationService.verifyResult`/`rejectResult`/`bulkVerify` (`:370`/`:415`) — technically verify another branch's result.
   - `ClinicalAuthorizationService` via `findResultById` (`:331-334`) — clinically authorize/return another branch's result (independently confirmed).
   A staff member in Branch A can advance/alter Branch B's clinical records by id.

5. **Leaked production credentials are still recoverable (verified live).**
   The Postgres password (`eta****`) and Gmail app password (`ttzj…`, 16 chars) appear in **`SECURITY.md` and across git history** (10+ commits) and are present on the **public** `origin/develop` and a feature branch — i.e. already exposed. `scripts/purge-secrets.sh` exists but was never run. `application.yml` *is* correctly externalized to env vars (the fix is half-done). **Treat both credentials as compromised: rotate now, then purge history.** (Literal values intentionally omitted from this report so the doc itself is safe to publish.)

---

## 4. HIGH findings (confirmed — fix before an IFS audit)

**Tenant isolation (write side):**
- `createOrder` trusts a client `patientId` with no existence/branch check → fabricated or cross-branch orders + bills + samples (`OrderService.java:172-225`).
- Patient `update` allows mass-assigning `branchCode` (silent cross-tenant move) and skips the branch read-guard (`PatientService.java:338`).
- Profile-photo read/write and document upload bypass branch isolation (`PatientService.java:204-237`, `PatientDocumentService.java:80-128`).
- `cancelOrder` has no branch check (`OrderService.java:977`).
- Bulk verification worklist and pending-samples queue are not branch-scoped → cross-branch PHI in routine screens (`VerificationService.java:280-308`, `:85`).
- DISPATCH role bypasses branch scoping entirely (`DispatchService.java:445-503`).

**Segregation of duties (four-eyes):**
- The MLT who enters a result can technically verify it (no enterer-vs-verifier check) (`VerificationService.java:370-411`), and there is no verifier-vs-authorizer check; MLT-entry and verification share the same roles.
- A `LAB_SUPERVISOR` (non-pathologist) can amend a result a pathologist already signed (`ResultAmendmentController.java:30`); the amended row keeps the prior pathologist's signature (`ResultAmendmentService.java:120-128`).

**Clinical correctness / safety:**
- Submitted result **unit is never validated against the parameter unit nor stored** → a wrong-unit numeric entry silently mis-flags (incl. a critical value scaled into the normal band) (`MltTestingService.java:241-251`).
- Children/neonates are silently flagged against **adult** reference/critical limits (only an age≥18 band is seeded; age is whole-years) (`ReferenceRangeMatcher.java:34-42`).
- Instrument ingestion advances a sample to VERIFIED on a **partial** result set (no panel-completeness guard the manual path enforces) (`InstrumentResultIngestionService.java:133-139`).
- Instrument auto-release **falls back to the analyzer flag alone** when a parameter's thresholds are unconfigured (`InstrumentResultIngestionService.java:100-104`); it also skips the age/sex banded ranges the manual path uses.
- Critical-value: scheduler has **no row-claim/distributed lock** → multi-instance double-send/double-escalate; escalation SLA is measured from raised-time and an **undelivered** callback burns escalation tiers; every critical routes to **one static on-call address** (the referring doctor is never contacted) (`CriticalValueScheduler.java`, `CriticalValueNotificationService.java:115-202`).
- Amended value **bypasses re-verification and pathologist re-authorization** (`ResultAmendmentService.java:120-128`).

**Dispatch:**
- SMS/WhatsApp are stubbed (`MockSmsService`) yet attempts are marked **DELIVERED** (`ReportDispatchChannelService.java:77-104`); no real PDF/report artifact is ever generated; `dispatchReport` has **no idempotency guard** → reports can be re-sent (`DispatchService.java:236-273`).

**Money / data integrity / eventing / ops:**
- No refund/reversal path; a paid order is uncancellable (reversal columns exist but are never written) (`BillingService.java:142-216`).
- Sri Lankan NIC validator is fully built but **wired into nothing** — identity numbers accepted with no validation (`PatientValidationService`).
- `orders.patient_id` is a loose `varchar(50)` with **no FK** to patient — the single most safety-critical link is DB-unenforced (`20260418131000_create_orders_billing_tables.xml:74`).
- Soft-delete is schema-wide but enforced **only ad-hoc per query** (zero `@SQLRestriction`/`@SQLDelete`) — any forgotten predicate resurfaces deleted patients/results/bills (`BaseEntity.java:41`).
- The hand-built Kafka `producerFactory` **silently discards** the `acks=all`/`idempotence`/`retries`/`delivery.timeout=120s` durability config that `application.yml` deliberately sets for "patient-safety" events (`KafkaConfig.java:36-47`).
- Deploy pipeline has **no environment/approval gate** and triggers on push to `enterprise-hardening` → a feature-branch commit auto-ships to the live host (`release.yml`); the GitHub OIDC role trusts `repo:org/repo:*` (**any** branch/PR/tag) (`github_oidc.tf:7`).

---

## 5. Cross-cutting themes

1. **Tenant isolation is correct on reads, systematically missing on writes.** It is applied by hand per-method instead of via a cross-cutting interceptor/`@PreFilter` or a Hibernate tenant filter. This single architectural choice is the root of most CRITICAL/HIGH security findings. *Fix once, centrally.*
2. **Good safety mechanisms, incomplete wiring.** The critical-value callback, dispatch, completeness check, and QC engine are all individually well-built — but they are **not invoked** from amendment, instrument completeness, or the release path. The danger lives at the boundaries between modules.
3. **Mock/stub state asserted as real.** SMS "DELIVERED" from a stub, QC dashboard with no gate, dead Kafka consumers, no PDF, ~half the super-admin consoles unlabelled mocks. The system reports capabilities and states it doesn't have — the most dangerous category for a reviewer's trust.
4. **Reference-range & unit logic is decorative on the outputs that matter.** Banded ranges are honored when flagging the live row but the dispatched report, HL7/FHIR export, and instrument auto-release all use the collapsed parameter default — so the flag and the printed range can contradict each other.
5. **Single-instance assumptions, multi-branch claims.** The scheduler and outbox relay have no leader election/`SKIP LOCKED`; safe only because compose runs one app container today. Undocumented as a constraint.
6. **Engineering discipline >> domain completeness.** The infra/testing/observability work is enterprise-track; the clinical business rules are not yet.

---

## 6. Genuine strengths (credit where due)

- **Tamper-evident, hash-chained audit log** — DB `BEFORE INSERT` seal trigger with `pg_advisory_xact_lock` serialization, append-only `UPDATE/DELETE/TRUNCATE` triggers that fire even for superuser, `@Immutable` JPA mapping, and a Java verifier that recomputes the SHA-256 recipe byte-for-byte, proven by a real-Postgres integration test. **Commercial-grade.**
- **Money handling** — `BigDecimal` + `HALF_UP` throughout, price snapshotted at order time, atomic order+bill+sample creation, optimistic-lock defense against double-payment, mandatory discount audit (reason/by/at).
- **`bulkVerify`** — `@Lazy` self-proxy so each item honors `REQUIRES_NEW`; truthful per-item VERIFIED/FAILED map (the historic "false success while rolling back" bug is correctly fixed and documented).
- **Transactional outbox core** — `MANDATORY` append in the business txn, send outside txn, `REQUIRES_NEW` idempotent `recordOutcome` via self-proxy, dead-letter cap, W3C traceparent stitched across the async hop.
- **Critical-value lifecycle design** — mandatory read-back, bounded escalation that dead-letters loudly, atomic open via `MANDATORY`, the `BaseEntity` merge-id gotcha correctly handled (uses the returned saved entity).
- **Instrument path** — more-severe-of-{analyzer, threshold} flag policy, never auto-releases a critical, fail-safe on an unknown analyzer flag, strict device→LOINC→parameter binding within the ordered test, robust ASTM checksum/NAK link layer with a bounded worker pool.
- **Read-path tenant isolation** — one canonical `SecurityUtils`, branch derived server-side from the JWT, fail-closed, 404-not-403 to avoid existence enumeration, proven by `TenantIsolationIntegrationTest`.
- **Frontend** — real Keycloak OIDC + PKCE (S256), `RoleGuard` fails closed and is driven by backend-issued nav (not raw client roles), backend `@PreAuthorize` is the real gate, blip-tolerant 3-strike token refresh, tokens in memory (not localStorage), conservative security headers.
- **Enterprise practice** — Testcontainers singleton harness with integration tests on the *dangerous* paths (verification/tenant-isolation/authorization/auto-verify-hold/critical-value/audit-chain/amendment); multi-repo CI/CD with gitleaks + CodeQL + Trivy + keyless OIDC; Terraform (RDS PITR, S3 SSE+versioning, Secrets Manager, IMDSv2, budget) with a **captured DR-drill transcript**; Prometheus + Alertmanager + Tempo + Grafana-as-code with clinical-safety alert rules.

---

## 7. Prioritized remediation

**P0 — blockers (do first):**
1. Rotate the leaked DB + Gmail credentials and **run `purge-secrets.sh`** (purge history + scrub `SECURITY.md`).
2. Add a single **server-side branch guard on every write path** (sample collect/reject, verify/reject/bulkVerify, clinical authorize/return, order create/cancel, patient update, document upload, photo) — ideally one cross-cutting `assertBranchAccess` aspect rather than per-method.
3. **Wire QC into the release path** — block/hold auto-release and flag verification when the governing control failed Westgard; give QC records a real key to the parameter/instrument.
4. **Wire amendment to the safety mechanisms** — recompute the flag, open a critical-value callback if the new value is critical, re-dispatch a corrected report, and reset verify/authorize state.
5. **Enforce panel completeness on the instrument path** (reuse `validateFinalSubmissionCompleteness`) so a partial analyzer message can't auto-verify a sample.

**P1 — before the IFS audit:**
6. Validate + store the result **unit**; seed **pediatric/neonatal** reference & critical ranges (and store the *effective* range on the result so the report matches the flag).
7. Enforce **segregation of duties** (enterer ≠ verifier ≠ authorizer); restrict amendment of authorized results to a pathologist; stop persisting a stale signature.
8. **Critical-value:** add a distributed lock / row-claim to the scheduler, measure the SLA from *notified* time, and resolve the recipient from a clinician directory (per-branch fallback).
9. Make `dispatchReport` **idempotent**, generate a real report **PDF**, and fail-closed (mark `SENT`, not `DELIVERED`) until a real SMS/WhatsApp provider is wired.
10. Add an **FK on `orders.patient_id`**, a global Hibernate **soft-delete filter** (`@SQLRestriction`/`@SQLDelete`), and a `(test_result_id, version_no)` unique constraint.
11. **CI/CD:** add a deploy **approval gate** (`environment:`), pin OIDC trust to specific refs (`repo:org/repo:ref:refs/heads/main`), pin the deployed image to a SHA (not `latest`), and add a JaCoCo **coverage gate** so the hard-won test coverage can't regress.

**P2 — maturity:**
12. Make the Kafka producer read `spring.kafka.producer.*` (restore the durability config); wire or remove the inert event topics + dead AFTER_COMMIT listener; purge the outbox; add a DLT watcher/alert.
13. No refund/reversal path → add one (finance role, audited). Wire the NIC validator. Add a `DataIntegrityViolationException` → 409 handler. Add tax/levy modelling. Branch-scope supplies and tie stock to collection (or document as out of scope).
14. Replace mock super-admin consoles or label every one with the `DemoDataBanner`; reconcile the FE billing role model (`FRONT_DESK/BRANCH_ADMIN`) with the backend (`BILLING_OFFICER`).

---

## 8. Bottom line for the IFS review

This is **not a typical student project** — the audit chain, outbox, integration-test harness, CI/CD, IaC and observability are things many shipping commercial teams don't have. A senior reviewer will respect the engineering judgment on display.

But it is **not yet an enterprise clinical system**, because the *clinical business logic* has a cluster of real safety blockers (QC not gating release, amendments not re-triggering safety flows, wrong-unit/pediatric mis-flagging) and the *security model* leaks across the write side and ships live secrets. These are concrete, well-scoped, and fixable — none require re-architecture. Close §7 P0–P1 and the system moves from "impressive prototype with enterprise scaffolding" (**56/100**) to "qualified enterprise-grade clinical LIMS" (~75+).
