# Durdans Hospital LIMS — Test Report (Review Pack)

> **Prepared for:** IFS Sri Lanka senior-engineer review · **Date:** 2026-06-19
> **Scope:** `lims-core-service` (api + app), `frontend`, `load-testing`.
> **Verdict:** the test pyramid now covers the three clinical-safety paths end-to-end
> against a real database, and the dangerous code (verification, authorization,
> tenant isolation, auto-verify HOLD, audit integrity) is tested — reversing the
> "safe code tested, dangerous code untested" inversion the roadmap called out.

---

## 1. Test inventory

| Type | Where | Count | Notes |
|---|---|---|---|
| Backend unit | `lims-core-service-api` validators + `app` domain logic | 5 (api) + ~12 (app) | NIC/phone/passport/email validators, ResultFlagResolver, ReferenceRangeMatcher, Westgard, ASTM codec, HL7/FHIR builders, Autoverification, **AuditChainVerifier**, **PiiMasker** |
| Backend integration (Testcontainers Postgres) | `app` — `extends AbstractIntegrationTest` | **9** | full Spring context + real Liquibase schema + JPA, see §3 |
| Backend slice (`@WebMvcTest`) | `app/dispatch` | 1 | DispatchController 401/200 |
| Frontend unit/component (Vitest + RTL) | `frontend/src` | 4 files / **13 tests** | format-id, api mappers, RoleGuard (fail-closed), AuthProvider (token-refresh policy) |
| Frontend e2e (Playwright) | `frontend/e2e` | 1 spec | unauthenticated → /login redirect + security headers |
| Load (k6) | `load-testing/k6` | 3 scripts | smoke / load / stress with SLO thresholds (p95<500ms, p99<1s, error<1%) |

Backend test classes: **23 in app + 5 in api**.

## 2. Coverage (freshly regenerated)

Regenerate: `cd apps/lims-core-service && JAVA_HOME=C:/Users/Kalana/.jdks/corretto-21.0.8 ./gradlew test jacocoTestReport`
(Docker must be running — integration tests use Testcontainers.)

| Module | Line | Instruction | Branch |
|---|---|---|---|
| `lims-core-service-app` | **27.5%** (1555/5652) | 28.2% (7112/25248) | 20.5% (530/2590) |
| `lims-core-service-api` | **29.8%** (64/215) | — | — |
| **Combined (line)** | **≈ 27.6%** (1619/5867) | | |

> This supersedes the roadmap's prior **~5.8%** estimate — the new integration tests
> drive the service/controller layers through a real context, so the measured number
> is materially higher. Coverage is **measured but not yet gated** (no
> `jacocoTestCoverageVerification` ratchet — workstream E10). HTML report:
> `lims-core-service-app/build/reports/jacoco/test/html/index.html`.

## 3. Clinical-safety paths — status

| Path | Status | Evidence |
|---|---|---|
| **Tenant isolation** (branch A cannot read/write branch B) | ✅ COVERED | `patient/TenantIsolationIntegrationTest` (5 cases) |
| **Verification** → reportable + audit + REQUIRES_NEW partial-commit | ✅ COVERED | `verification/VerificationFlowIntegrationTest` (verify flips state + audit; bulkVerify commits successes while a sibling fails) |
| **Clinical authorization** (signed release + dispatch registration) | ✅ COVERED | `clinical/ClinicalAuthorizationIntegrationTest` (signed happy path + dispatch row; unsigned rejected, no state change) |
| **Auto-verify HOLD on CRITICAL** blocks reporting | ✅ COVERED | `instrument/AutoverificationHoldIntegrationTest` (critical held in ENTERED / sample SENT_FOR_VERIFICATION; normal auto-releases) |
| **Tamper-evident audit** (H3) | ✅ COVERED | `audit/AuditChainIntegrationTest` (chain verifies; UPDATE/DELETE rejected by trigger) + `AuditChainVerifierTest` |
| **Result amendment / versioning** (H2) | ✅ COVERED | `service/ResultAmendmentIntegrationTest` (release preserved as new version; unreleased/unsigned rejected) |
| **Critical-value callback** (H1) | ✅ COVERED | `notification/CriticalValueNotificationIntegrationTest` (raise → notify → read-back ack → escalate) |
| **Resilience** (F2 retry/breaker/fallback) | ✅ COVERED | `resilience/F2ResilienceIntegrationTest` |

> The integration suite caught a **real production bug** during authoring: a new
> result's id was null after `save()` (BaseEntity's non-null `@Version` turns the
> insert into a merge), which would have null-FK'd the H1 callback. Fixed — exactly the
> value an integration test is meant to provide.

## 4. How to run each suite

```bash
# Backend (Docker required for Testcontainers)
cd apps/lims-core-service
JAVA_HOME=C:/Users/Kalana/.jdks/corretto-21.0.8 ./gradlew test            # all
JAVA_HOME=... ./gradlew test --tests "com.uom.lims.verification.*"        # one package
JAVA_HOME=... ./gradlew test jacocoTestReport                             # + coverage

# Frontend
cd apps/frontend
pnpm install
pnpm test            # Vitest unit/component
pnpm coverage        # + v8 coverage
pnpm exec playwright install chromium && pnpm e2e   # Playwright smoke (first run installs the browser)

# Load (k6)  — see load-testing/README.md
k6 run --summary-export load-testing/results/load-summary.json load-testing/k6/load.js
```

CI runs the backend `./gradlew clean build` on push/PR to `develop`/`main`/`enterprise-hardening` (`lims-core-service/.github/workflows/ci.yml`), plus gitleaks + CodeQL.

## 5. Gaps honestly disclosed

| Gap | Roadmap id | Why it matters |
|---|---|---|
| Per-`@PreAuthorize` controller slices not exhaustive | E4 | Each role gate should have a 401/403/200 slice |
| Outbox/dispatch reliability tests (at-least-once, idempotent redelivery) | E6 | Proves no dropped/duplicated domain events |
| Instrument ingest → autoverify e2e against the simulator | E7 | The demoable machine→LIMS loop is only unit/integration-tested in parts |
| Billing charge-calc + bill-state tests | E8 | Money math is untested |
| k6 results not yet committed as an artifact | E5 | Scripts have SLO thresholds but no captured run is attached |
| JaCoCo coverage **gate/ratchet** | E10 | Coverage is measured but cannot regress-block today |
| Frontend coverage is shallow (4 unit files + 1 e2e) | E9 | Core guards/mappers covered; most screens are not |

## 6. Evidence artifacts to attach

- JaCoCo HTML: `lims-core-service-app/build/reports/jacoco/test/html/index.html`
- Gradle test report: `lims-core-service-app/build/reports/tests/test/index.html`
- Frontend Vitest output (`pnpm test`) and `pnpm coverage`
- k6 `--summary-export` JSON (once a run is captured, `load-testing/results/`)
- CI run link (GitHub Actions `build-test` job)

**Next test priorities:** E4 (controller slices) → E5 (capture k6) → E6 (outbox reliability) → E10 (JaCoCo ratchet).
