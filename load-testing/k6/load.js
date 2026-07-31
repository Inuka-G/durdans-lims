// Load test — ramps to 50 concurrent users against the authenticated read path and
// asserts SLOs (p95 < 500ms, p99 < 1s, <1% errors). Thresholds make the run FAIL
// (non-zero exit) if the SLO is breached, so it can gate CI.
//
//   k6 run -e BASE_URL=http://localhost:11000 -e KEYCLOAK_URL=http://localhost:8081 \
//          -e TEST_USER=mlt1 -e TEST_PASS=Passw0rd! \
//          --summary-export load-testing/results/load-summary.json \
//          load-testing/k6/load.js
import http from "k6/http";
import { check } from "k6";
import { getToken, authHeaders } from "./lib/auth.js";

const BASE_URL = __ENV.BASE_URL || "http://localhost:11000";

export const options = {
  scenarios: {
    ramp: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 20 },
        { duration: "1m", target: 20 },
        { duration: "30s", target: 50 },
        { duration: "1m", target: 50 },
        { duration: "30s", target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<500", "p(99)<1000"],
    checks: ["rate>0.99"],
  },
};

export function setup() {
  return { token: getToken() };
}

export default function (data) {
  const h = authHeaders(data.token);
  const res = http.get(`${BASE_URL}/api/v1/patients?page=0&size=20`, h);
  check(res, {
    "status is 200": (r) => r.status === 200,
    "has a JSON body": (r) => String(r.headers["Content-Type"] || "").includes("application/json"),
  });
}
