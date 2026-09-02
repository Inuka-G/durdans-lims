import keycloak from "@/lib/keycloak";

export function useAuth() {
  // keycloak is null during SSR / before init — guard every access.
  const claims = keycloak?.tokenParsed as
    | (Record<string, unknown> & { realm_access?: { roles?: string[] } })
    | undefined;

  // The realm emits the branch under one of several names depending on the
  // mapper; mirror the backend's SecurityUtils.getCurrentBranchId() order so the
  // two agree on which branch the user belongs to.
  const branchClaim =
    claims?.["branch_id"] ??
    claims?.["branch_code"] ??
    claims?.["branch"] ??
    claims?.["branchCode"];

    const rawBranchClaim = branchClaim;
    const branchString = Array.isArray(rawBranchClaim) ? rawBranchClaim[0] : rawBranchClaim;

    return {
        token: keycloak?.token,
        user: keycloak?.tokenParsed,
        roles: claims?.realm_access?.roles ?? [],
        branchCode:
            typeof branchString === "string" && branchString.trim()
                ? branchString.trim().toUpperCase()
                : undefined,
        authenticated: Boolean(keycloak?.authenticated),
    logout: () => keycloak?.logout(),
  };
}
