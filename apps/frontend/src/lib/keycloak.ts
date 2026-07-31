import Keycloak from"keycloak-js";

const keycloakConfig = {
 url: process.env.NEXT_PUBLIC_KEYCLOAK_URL ||"http://localhost:8081",
 realm: process.env.NEXT_PUBLIC_KEYCLOAK_REALM ||"lims-realm",
 clientId: process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID ||"lims-frontend",
};

// Initialize Keycloak instance only if we are on the client side.
// Typed nullable (it IS null during SSR) so callers must null-guard rather than
// risk a "Cannot read properties of null" at render time.
const keycloak: Keycloak | null = typeof window !== "undefined" ? new Keycloak(keycloakConfig) : null;

export default keycloak;