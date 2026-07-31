// Stress test — pushes well past expected load to find the breaking point and
// confirm the service degrades gracefully (no 5xx storm, recovers on ramp-down).
// No hard thresholds: this run is exploratory, read the output curves.
//
//   k6 run -e BASE_URL=http://localhost:11000 -e KEYCLOAK_URL=http://localhost:8081 \
//          -e TEST_USER=mlt1 -e TEST_PASS=Passw0rd! load-testing/k6/stress.js
import http from "k6/http";
import { check } from "k6";
import { getToken, authHeaders } from "./lib/auth.js";

const BASE_URL = __ENV.BASE_URL || "http://localhost:11000";

export const options = {
  scenarios: {
    stress: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1m", target: 100 },
        { duration: "2m", target: 200 },
        { duration: "2m", target: 300 },
        { duration: "1m", target: 0 },
      ],
    },
  },
};

export function setup() {
  return { token: getToken() };
}

export default function (data) {
  const h = authHeaders(data.token);
  const res = http.get(`${BASE_URL}/api/v1/patients?page=0&size=20`, h);
  check(res, { "not a 5xx": (r) => r.status < 500 });
}
