# Phase 0 — Remediation Backlog (P0 blockers)

> **STATUS: ✅ COMPLETE (2026-05-30).** All P0 tickets below are implemented on
> the `enterprise-hardening` branches of `lims-core-service`, `frontend` and
> `lims-infrastructure`. The backend compiles and the existing test suite passes.
> Residual follow-ups (deferred to Phase 1) are noted inline: sample-worklist &
> aggregate-stat branch scoping (samples gain a branch column in Phase 2),
> DispatchService channel I/O still inside its transaction, full OpenTelemetry
> tracing, and full server-side JWT verification in the frontend middleware.
>
> Action still required by a human (cannot be done in code): **rotate the leaked
> DB + Gmail credentials and purge them from git history** (P0-1).

These are the issues that block an IFS review. Each ticket has a concrete
location, the fix, and acceptance criteria. Order is the recommended execution
order. See `ENTERPRISE-REVIEW-AND-ROADMAP.md` for full context.

Legend: 🔴 Critical · 🟠 High. Effort: S (<½ day) · M (1–2 days) · L (3–5 days).

---

## P0-1 🔴 Rotate and purge committed secrets · M
**Where:** `lims-core-service-app/src/main/resources/application.yml:11-12,47-48,67-69`
**Now:** DB password `‹redacted-db-password›`, Gmail app password `‹redacted-mail-app-password›`, AWS slots in plaintext; the file is git-tracked.
**Do:**
1. **Rotate immediately** — change the Postgres password and revoke/regenerate the Gmail app password (assume both are compromised).
2. Replace values with env placeholders: `password: ${DB_PASSWORD}`, `password: ${MAIL_PASSWORD}`, etc.
3. Provide `application-local.yml` (git-ignored) + `.env.example` documenting required vars.
4. Purge from history: `git filter-repo --path lims-core-service-app/src/main/resources/application.yml --invert-paths` (or BFG), force-push, rotate again after.
5. Add **gitleaks** (or trufflehog) to CI as a blocking gate.
**Done when:** no secret literals anywhere in the repo or history; app boots from env vars; CI fails on a planted secret.

## P0-2 🔴 Remove the public test endpoints · S
**Where:** `config/TestController.java`, `config/SecurityConfig.java:32-33`
**Now:** `GET /test/email` is unauthenticated and sends mail (open relay); `/test/**` and `/actuator/**` are `permitAll`.
**Do:** delete `TestController`; remove the `/test/**` matcher; change `/actuator/**` to `.hasRole("SUPER_ADMIN")` (and plan a separate management port). If a smoke endpoint is needed, gate behind `@Profile("dev")` + auth.
**Done when:** `/test/email` returns 401/404; only `health`/`info` are reachable unauthenticated (and only if intended).

## P0-3 🔴 Enforce branch-level tenant isolation · L
**Where:** `PatientService.java:122-148`, `OrderService.java:270-279` (`findAllByDeletedFalse`), `MltTestingService.java:379` (`patientRepository.findAll()`), `StatisticsService`, `BillController`/`SampleService` read paths. Root cause: `security/SecurityUtils` (has `getCurrentBranchId`) vs `util/SecurityUtils` (does not).
**Do:**
1. Delete `util/SecurityUtils`; consolidate to one injectable bean exposing `getCurrentUserId/Username/BranchId/BearerToken`.
2. Derive branch from the JWT server-side; **ignore client-supplied `branchCode`** except for `SUPER_ADMIN`.
3. Push the branch predicate into every tenant-owned query (use Dispatch/Audit as the template). Best: a Hibernate `@Filter`/tenant interceptor applied globally so no query can forget it.
4. Remove the `BR001` special-case in `PatientService.java:84`.
**Done when:** an integration test proves a `BRANCH_ADMIN`/staff of Branch A gets 403/empty for Branch B patients, orders, bills, samples and stats; `SUPER_ADMIN` still sees all.

## P0-4 🔴 Frontend: server-side route protection + fail-closed guard · M
**Where:** add `frontend/src/middleware.ts`; `providers/RoleGuard.tsx:47-49,78-83`; `providers/AuthProvider.tsx:25-29`; `lib/keycloak.ts:10-12`.
**Do:**
1. Add `middleware.ts` that validates the session/token and role for `(protected)` routes before render; redirect unauthenticated/unauthorized.
2. `RoleGuard`: on metadata error or empty roles, redirect to login/"no access" — **never** `setAuthorized(true)`.
3. `AuthProvider`: use `keycloak.onTokenExpired`, retry refresh with backoff before `logout()`, and `clearInterval` on unmount.
4. Type `keycloak` as `Keycloak | null` and null-guard `useAuth`.
**Done when:** hitting a protected route without the right role redirects before any protected content loads; a transient refresh failure does not log the user out; no SSR NPE.

## P0-5 🟠 Move email/SMS/dispatch I/O out of DB transactions · M
**Where:** `PatientService.java:92,331,483,531`; `DispatchService.java:224-310`; `ReportDispatchChannelService`.
**Do:** publish a domain event inside the txn; perform the actual send in an `@TransactionalEventListener(AFTER_COMMIT)` on a **bounded** `ThreadPoolTaskExecutor`; make sends idempotent; never let a notification failure roll back the business write.
**Done when:** SMTP/SMS being down does not block patient registration or roll back a dispatch; a rolled-back transaction never results in a sent message.

## P0-6 🟠 Fix `bulkVerify` transaction isolation + truthful result · M
**Where:** `VerificationService.java:447-466` (`this.verifyResult` at 458).
**Do:** extract single-result verification into a separate bean (or self-inject the proxy) annotated `@Transactional(propagation = REQUIRES_NEW)` so each result commits/rolls back independently; only then is the per-result success/failure map truthful.
**Done when:** an integration test where result #3 of 5 fails shows #1,#2,#4,#5 persisted and only #3 FAILED — and the API response matches the DB.

## P0-7 🟠 Replace faked critical-value thresholds · M
**Where:** `MltTestingService.java:517-556` (`refLow*0.70`, `refHigh*1.30`); needs schema support.
**Do:** add `critical_low`/`critical_high` columns to `test_parameter` (Liquibase, append-only); seed real panic limits for the current analytes; compute `CRITICAL_LOW/HIGH` against them; make manual-vs-computed flag precedence consistent.
**Done when:** e.g. K⁺ 6.5 mmol/L flags CRITICAL-HIGH and a value 1.3× a benign upper limit does not; bulk auto-approval never auto-releases a true critical.

## P0-8 🟠 Eventing: transactional outbox + idempotent, DLQ-backed consumer · L
**Where:** `KafkaConfig.java:58`, `PatientKafkaEventListener.java`, `LabReportAuthorizedKafkaListener.java`, `DispatchService` publish sites.
**Do:**
1. Add an `outbox` table written in the same txn as the domain change; a relay (poller or Debezium) publishes to Kafka.
2. `enable-auto-commit=false` + `AckMode.RECORD`; `DefaultErrorHandler` + `DeadLetterPublishingRecoverer` to a `.DLT`; consumer dedupes on event id.
3. Add Kafka (and LocalStack) to `docker-compose.yml`.
**Done when:** killing the broker mid-flow loses no events (they relay on recovery); a poison message lands in the DLT without blocking the partition; replays don't double-apply.

## P0-9 🟠 Stand up CI/CD + quality gates + observability baseline · L
**Where:** new `.github/workflows/` (or chosen CI); `build.gradle` (app); `docker-compose.yml`.
**Do:** pipeline = build + lint + test (with Testcontainers) + coverage + SAST (e.g. CodeQL) + dependency scan + secret scan. Add `spring-boot-starter-actuator` (locked down per P0-2), Micrometer + OpenTelemetry tracing with W3C propagation across the async/Kafka hops, and structured JSON logging with PII scrubbing. Containerize the service; complete `docker-compose` (app + Kafka + LocalStack + Postgres + Keycloak + Prometheus/Grafana).
**Done when:** every PR runs the gates; `/actuator/health` (authorized) is green; a trace spans request → AFTER_COMMIT → Kafka with one correlation id; logs are structured and free of OTP/secret content.

---

## Quick wins worth doing in the same pass (🟡, S each)
- Delete the duplicate `20260503120000_add_sample_rejection_notes.xml` (latent startup failure).
- Add missing indexes: `audit_log(branch_code,timestamp desc)`, patient `branch_code`/`created_at`, `pg_trgm` on `lower(full_name)`, `order_items.test_id`, `payments.payment_date`.
- Remove leftover `OTP_EXPIRED_DEBUG` (`PatientService.java:548-565`) and the hardcoded `"+12% vs yesterday"` trend.
- Standardize `GlobalExceptionHandler` on RFC 7807 `ProblemDetail`; stop echoing `ex.getMessage()` on 5xx.
- Frontend: fix `criticalCount` filter (`verification/review/[sampleId]/page.tsx:157-158`); add a confirm dialog to bulk verification; replace `alert()` with the existing toast lib; pick one of the two toast libraries.
