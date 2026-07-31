import keycloak from "@/lib/keycloak";

export function useAuth() {
  // keycloak is null during SSR / before init — guard every access.
  return {
    token: keycloak?.token,
    user: keycloak?.tokenParsed,
    roles: keycloak?.tokenParsed?.realm_access?.roles ?? [],
    authenticated: Boolean(keycloak?.authenticated),
    logout: () => keycloak?.logout(),
  };
}
