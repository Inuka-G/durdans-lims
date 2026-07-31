// Smoke test — 1 VU, a few iterations. Confirms the stack is up and the auth +
// read path returns 200s before any heavier load run. Run:
//   k6 run -e BASE_URL=http://localhost:11000 -e KEYCLOAK_URL=http://localhost:8081 \
//          -e TEST_USER=mlt1 -e TEST_PASS=Passw0rd! load-testing/k6/smoke.js
import http from "k6/http";
import { check, sleep } from "k6";
import { getToken, authHeaders } from "./lib/auth.js";

export const options = {
  vus: 1,
  iterations: 5,
  thresholds: {
    checks: ["rate>0.99"],
    http_req_failed: ["rate<0.01"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:11000";

export function setup() {
  return { token: getToken() };
}

export default function (data) {
  // Authenticated read of the patient search (branch-scoped on the server).
  const res = http.get(`${BASE_URL}/api/v1/patients?page=0&size=10`, authHeaders(data.token));
  check(res, {
    "patients list 200": (r) => r.status === 200,
    "responds < 800ms": (r) => r.timings.duration < 800,
  });
  sleep(1);
}
