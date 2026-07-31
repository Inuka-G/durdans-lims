package com.uom.lims.security;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;

/**
 * Single canonical accessor for the authenticated caller's identity and branch.
 *
 * <p>This is the only SecurityUtils in the codebase. It replaced a second,
 * divergent copy in {@code com.uom.lims.util} whose instances had no branch
 * accessor — which is why the billing/order/sample services could not enforce
 * branch isolation. All identity and tenant decisions now flow through here.
 */
public final class SecurityUtils {

    private static final Logger log = LoggerFactory.getLogger(SecurityUtils.class);

    /** Fallback principal for system/unauthenticated contexts (async, schedulers, Kafka). */
    public static final String SYSTEM = "system";

    private SecurityUtils() {
    }

    private static Jwt jwt() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof Jwt jwt) {
            return jwt;
        }
        return null;
    }

    /**
     * The caller's branch, normalised to upper-case, or {@code null} if the JWT
     * carries no branch claim. Used to scope tenant-owned data.
     */
    public static String getCurrentBranchId() {
        Jwt jwt = jwt();
        if (jwt == null) {
            return null;
        }
        String branchId = firstNonBlank(
                jwt.getClaimAsString("branch_id"),
                jwt.getClaimAsString("branch_code"),
                jwt.getClaimAsString("branch"),
                jwt.getClaimAsString("branchCode"));
        if (branchId == null) {
            log.warn("Branch claim missing from JWT for user '{}'", safeUser(jwt));
            return null;
        }
        return branchId.trim().toUpperCase();
    }

    /** Stable Keycloak subject (UUID), or {@link #SYSTEM} when unauthenticated. */
    public static String getCurrentUserId() {
        Jwt jwt = jwt();
        return jwt != null ? jwt.getSubject() : SYSTEM;
    }

    /** Human-readable actor for audit/createdBy: full name, else login id, else {@link #SYSTEM}. */
    public static String getCurrentUsername() {
        Jwt jwt = jwt();
        if (jwt == null) {
            return SYSTEM;
        }
        String name = jwt.getClaimAsString("name");
        if (name != null && !name.isBlank()) {
            return name;
        }
        String username = jwt.getClaimAsString("preferred_username");
        return (username != null && !username.isBlank()) ? username : SYSTEM;
    }

    public static String getCurrentDisplayName() {
        Jwt jwt = jwt();
        if (jwt == null) {
            return null;
        }
        String name = jwt.getClaimAsString("name");
        if (name != null && !name.isBlank()) {
            return name;
        }
        String givenName = jwt.getClaimAsString("given_name");
        String familyName = jwt.getClaimAsString("family_name");
        String fullName = ((givenName != null ? givenName : "") + " "
                + (familyName != null ? familyName : "")).trim();
        if (!fullName.isBlank()) {
            return fullName;
        }
        return getCurrentUsername();
    }

    /** {@code "Bearer <token>"} for forwarding identity downstream, or {@code null}. */
    public static String getCurrentBearerToken() {
        Jwt jwt = jwt();
        return jwt != null ? "Bearer " + jwt.getTokenValue() : null;
    }

    /** True if the caller holds the given realm role (with or without the {@code ROLE_} prefix). */
    public static boolean hasRole(String role) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null) {
            return false;
        }
        String wanted = role.startsWith("ROLE_") ? role : "ROLE_" + role;
        for (GrantedAuthority authority : authentication.getAuthorities()) {
            if (wanted.equals(authority.getAuthority())) {
                return true;
            }
        }
        return false;
    }

    public static boolean isSuperAdmin() {
        return hasRole("SUPER_ADMIN");
    }

    public static boolean isAuthenticated() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication != null && authentication.getPrincipal() instanceof Jwt;
    }

    /**
     * The branch a tenant-scoped query must be restricted to: {@code null} means
     * "all branches" and is granted ONLY to SUPER_ADMIN; every other caller is
     * pinned to their own branch. Services must apply this so a branch user can
     * never read another branch's data, regardless of any client-supplied value.
     *
     * <p>Fails closed: a non-super-admin whose token carries no branch is denied
     * rather than silently shown every branch.
     */
    public static String resolveBranchScope() {
        if (isSuperAdmin()) {
            return null;
        }
        String branch = getCurrentBranchId();
        if (branch == null) {
            throw new AccessDeniedException("No branch assigned to the current user");
        }
        return branch;
    }

    /**
     * Guard a single tenant-owned record: throws if the caller (non-super-admin)
     * is not in the record's branch. {@code null} resourceBranch is treated as
     * inaccessible to non-super-admins.
     */
    public static boolean canAccessBranch(String resourceBranch) {
        if (isSuperAdmin()) {
            return true;
        }
        String mine = getCurrentBranchId();
        return mine != null && mine.equalsIgnoreCase(resourceBranch);
    }

    private static String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    private static String safeUser(Jwt jwt) {
        String username = jwt.getClaimAsString("preferred_username");
        return username != null ? username : jwt.getSubject();
    }
}
