# Load & performance testing (k6)

Evidence that the LIMS was load-tested, as the review asks for. Scripts target the
JWT-protected API and assert SLOs as pass/fail thresholds (so they can gate CI).

## Scripts

| Script | Purpose | Pass/fail |
|--------|---------|-----------|
| `k6/smoke.js`  | 1 VU, 5 iters — "is it alive and authenticated?" | yes |
| `k6/load.js`   | ramp to 50 VUs — SLO: p95 < 500ms, p99 < 1s, errors < 1% | yes (thresholds) |
| `k6/stress.js` | ramp to 300 VUs — find the breaking point | no (exploratory) |

`k6/lib/auth.js` fetches a real Keycloak token (password grant) so the runs hit the
same auth path as the app.

## Prerequisites

- The stack running (`cd lims-infrastructure && docker compose up -d`).
- A test user in the `lims-realm` (e.g. `mlt1`) with a known password and a role that
  can read patients. Direct-access grants must be enabled on the `lims-frontend`
  client (or pass a confidential client via `KEYCLOAK_CLIENT_ID/SECRET`).

## Run

```bash
# install k6: https://k6.io/docs/get-started/installation/
k6 run -e BASE_URL=http://localhost:11000 \
       -e KEYCLOAK_URL=http://localhost:8081 \
       -e TEST_USER=mlt1 -e TEST_PASS='Passw0rd!' \
       --summary-export load-testing/results/load-summary.json \
       load-testing/k6/load.js
```

The exported summary (p95/p99, RPS, error rate) is the artifact to attach to the
review pack. In CI, a failed threshold returns a non-zero exit and fails the job.

## Tuning the SLOs

Edit the `thresholds` block in `load.js`. The defaults (p95 < 500ms) are a sensible
target for branch-scoped read endpoints on a `t3.small`; adjust to your environment
and record the rationale.
