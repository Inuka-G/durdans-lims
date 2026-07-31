// Shared Keycloak auth helper for the k6 scripts. Obtains a real access token via
// the OAuth2 password grant against the running Keycloak, so the load tests exercise
// the same JWT-protected endpoints a real client hits.
import http from "k6/http";

const KEYCLOAK_URL = __ENV.KEYCLOAK_URL || "http://localhost:8081";
const REALM = __ENV.KEYCLOAK_REALM || "lims-realm";
const CLIENT_ID = __ENV.KEYCLOAK_CLIENT_ID || "lims-frontend";
const CLIENT_SECRET = __ENV.KEYCLOAK_CLIENT_SECRET || "";
const USER = __ENV.TEST_USER || "mlt1";
const PASS = __ENV.TEST_PASS || "Passw0rd!";

export function getToken() {
  const url = `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token`;
  const payload = {
    grant_type: "password",
    client_id: CLIENT_ID,
    username: USER,
    password: PASS,
  };
  if (CLIENT_SECRET) payload.client_secret = CLIENT_SECRET;

  const res = http.post(url, payload, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  if (res.status !== 200) {
    throw new Error(`Keycloak token request failed: ${res.status} ${res.body}`);
  }
  return res.json("access_token");
}

export function authHeaders(token) {
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  };
}
