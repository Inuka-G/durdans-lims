package com.uom.lims.admin;

import com.uom.lims.exception.BusinessRuleException;
import com.uom.lims.metadata.BranchRepository;
import com.uom.lims.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.keycloak.admin.client.CreatedResponseUtil;
import org.keycloak.admin.client.Keycloak;
import org.keycloak.admin.client.resource.RealmResource;
import org.keycloak.admin.client.resource.UserResource;
import org.keycloak.representations.idm.CredentialRepresentation;
import org.keycloak.representations.idm.RoleRepresentation;
import org.keycloak.representations.idm.UserRepresentation;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Set;

import jakarta.ws.rs.core.Response;
import com.uom.lims.metadata.BranchRepository;
import com.uom.lims.entity.BranchEntity;

/**
 * User lifecycle management via the Keycloak Admin API, branch-scoped.
 *
 * <p>SUPER_ADMIN manages users in any branch; a BRANCH_ADMIN may only list/create
 * users in their own branch (enforced here, server-side, regardless of any
 * client-supplied branch). The branch is stored as a Keycloak user attribute.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = "app.keycloak-admin.enabled", havingValue = "true")
public class AdminUserService {

    private static final String BRANCH_ATTR = "branch_id";

    /**
     * Every realm role this endpoint is willing to assign, mirroring the RBAC
     * table in README.md. Grants outside this set (typos, or one of Keycloak's
     * own built-ins, e.g. default-roles-lims-realm, offline_access) are rejected
     * up front — both to keep a mistyped role from 500-ing after the Keycloak
     * user already exists (an orphaned, role-less account), and so the set below
     * is the one place that decides what's grantable at all.
     */
    private static final Set<String> MANAGED_ROLES = Set.of(
            "MLT", "LAB_SUPERVISOR", "PATHOLOGIST", "PHLEBOTOMIST",
            "FRONT_DESK", "DISPATCH", "BRANCH_ADMIN", "SUPER_ADMIN");

    private final Keycloak adminKeycloak;
    private final BranchRepository branchRepository;

    @Value("${app.keycloak-admin.realm:lims-realm}")
    private String realm;

    private RealmResource realm() {
        return adminKeycloak.realm(realm);
    }

    public List<AdminUserResponse> listUsers() {
        String scope = SecurityUtils.resolveBranchScope(); // null => all (SUPER_ADMIN)
        // .list()/.list(first,max) return Keycloak's "brief" representation, which
        // omits custom attributes entirely — branch_id included. That's harmless
        // for SUPER_ADMIN (scope == null, no filtering happens) but silently
        // broke every BRANCH_ADMIN: attribute(u, BRANCH_ATTR) always came back
        // null, so scope.equalsIgnoreCase(null) was always false and their user
        // list was always empty. search(null, ...) with no query behaves like
        // list() but takes the briefRepresentation flag.
        return realm().users().search(null, null, null, false).stream()
                .filter(u -> scope == null || scope.equalsIgnoreCase(attribute(u, BRANCH_ATTR)))
                .map(u -> toResponse(u, managedRolesOf(u.getId())))
                .toList();
    }

    public AdminUserResponse createUser(CreateUserRequest request) {
        // Extract current admin's username from the security context
        Object principal = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        String currentUsername = null;
        if (principal instanceof org.springframework.security.oauth2.jwt.Jwt) {
            currentUsername = ((org.springframework.security.oauth2.jwt.Jwt) principal).getClaimAsString("preferred_username");
        }
        
        if (currentUsername == null) {
            throw new RuntimeException("Unable to determine current admin username.");
        }

        // Verify the admin's password before proceeding
        keycloakAdminService.verifyUserPassword(currentUsername, request.adminPassword());

        String scope = SecurityUtils.resolveBranchScope();
        // A branch admin can only create into their own branch; super-admin uses
        // the requested branch.
        String branch = (scope == null) ? request.branchCode() : scope;
        if (branch == null || branch.isBlank()) {
            throw new BusinessRuleException("A branch is required for the new user");
        }
        // A branch admin's own scope came from their JWT, already a real
        // branch; a super-admin's supplied code is client input and needs
        // checking against the real directory before anything is created.
        if (scope == null) {
            assertBranchExists(branch);
        }
        // Validate the role BEFORE creating anything in Keycloak: a role that
        // fails this check must never leave behind a role-less orphaned account.
        RoleRepresentation role = request.role() == null || request.role().isBlank()
                ? null
                : assertRoleGrantable(request.role());

        BranchEntity branchEntity = branchRepository.findByCode(branch)
                .orElseThrow(() -> new BusinessRuleException("Branch not found: " + branch));
        if (!"Active".equalsIgnoreCase(branchEntity.getStatus())) {
            throw new BusinessRuleException("Users can only be created or assigned to active branches.");
        }

        UserRepresentation user = new UserRepresentation();
        user.setUsername(request.username());
        user.setEmail(request.email());
        user.setFirstName(request.firstName());
        user.setLastName(request.lastName());
        // Honour the caller's requested initial status; defaults to active when
        // omitted so existing callers (and the "no status field" case) behave as
        // before.
        user.setEnabled(request.enabled() == null || request.enabled());
        user.setAttributes(Map.of(BRANCH_ATTR, List.of(branch)));

        String userId;
        try (Response response = realm().users().create(user)) {
            if (response.getStatus() != 201) {
                throw new BusinessRuleException("Failed to create user (status " + response.getStatus() + ")");
            }
            userId = CreatedResponseUtil.getCreatedId(response);
        }

        if (request.temporaryPassword() != null && !request.temporaryPassword().isBlank()) {
            CredentialRepresentation credential = new CredentialRepresentation();
            credential.setType(CredentialRepresentation.PASSWORD);
            credential.setValue(request.temporaryPassword());
            credential.setTemporary(true);
            realm().users().get(userId).resetPassword(credential);
        }

        if (role != null) {
            realm().users().get(userId).roles().realmLevel().add(List.of(role));
        }

        return toResponse(realm().users().get(userId).toRepresentation(), managedRolesOf(userId));
    }

    /**
     * Updates identity fields, branch and/or role for an existing user. Unlike
     * {@link #setEnabled}, this never touches the enabled flag — that stays the
     * dedicated activate/deactivate action's job.
     */
    public AdminUserResponse updateUser(String userId, UpdateUserRequest request) {
        UserResource userResource = realm().users().get(userId);
        UserRepresentation user = userResource.toRepresentation();
        if (!SecurityUtils.canAccessBranch(attribute(user, BRANCH_ATTR))) {
            throw new BusinessRuleException("User not found");
        }

        RoleRepresentation newRole = request.role() == null || request.role().isBlank()
                ? null
                : assertRoleGrantable(request.role());

        if (request.firstName() != null) {
            user.setFirstName(request.firstName());
        }
        if (request.lastName() != null) {
            user.setLastName(request.lastName());
        }
        if (request.email() != null) {
            user.setEmail(request.email());
        }
        if (request.branchCode() != null && !request.branchCode().isBlank()) {
            // A branch admin can only ever leave a user pinned to their own
            // branch, regardless of what branch code the client sends.
            String scope = SecurityUtils.resolveBranchScope();
            String targetBranch = (scope == null) ? request.branchCode() : scope;
            if (scope == null) {
                assertBranchExists(targetBranch);
            }
            user.setAttributes(Map.of(BRANCH_ATTR, List.of(targetBranch)));
        }
        userResource.update(user);

        if (newRole != null) {
            List<RoleRepresentation> currentManaged = userResource.roles().realmLevel().listAll().stream()
                    .filter(r -> MANAGED_ROLES.contains(r.getName()))
                    .toList();
            if (!currentManaged.isEmpty()) {
                userResource.roles().realmLevel().remove(currentManaged);
            }
            userResource.roles().realmLevel().add(List.of(newRole));
        }

        return toResponse(userResource.toRepresentation(), managedRolesOf(userId));
    }

    public void setEnabled(String userId, boolean enabled) {
        UserRepresentation user = realm().users().get(userId).toRepresentation();
        if (!SecurityUtils.canAccessBranch(attribute(user, BRANCH_ATTR))) {
            throw new BusinessRuleException("User not found");
        }
        user.setEnabled(enabled);
        realm().users().get(userId).update(user);
    }

    /**
     * Rejects any role outside {@link #MANAGED_ROLES}, and — the actual fix for
     * the privilege-escalation gap — rejects SUPER_ADMIN unless the caller
     * already holds it. A BRANCH_ADMIN's own create/edit requests are branch-
     * scoped server-side (see createUser/updateUser above), but nothing short of
     * this check stopped that same branch-scoped caller from handing a brand
     * new account the SUPER_ADMIN role, which has no branch scope at all.
     */
    private RoleRepresentation assertRoleGrantable(String roleName) {
        if (!MANAGED_ROLES.contains(roleName)) {
            throw new BusinessRuleException("Unknown role: " + roleName);
        }
        if ("SUPER_ADMIN".equals(roleName) && !SecurityUtils.isSuperAdmin()) {
            throw new BusinessRuleException("Only a super admin can grant the super admin role");
        }
        return realm().roles().get(roleName).toRepresentation();
    }

    /** Rejects a branch code that doesn't exist in the real branch directory. */
    private void assertBranchExists(String code) {
        if (branchRepository.findByCode(code.trim().toUpperCase()).isEmpty()) {
            throw new BusinessRuleException("Unknown branch: " + code);
        }
    }

    /** This user's directly-assigned realm roles, restricted to ones we manage. */
    private List<String> managedRolesOf(String userId) {
        return realm().users().get(userId).roles().realmLevel().listAll().stream()
                .map(RoleRepresentation::getName)
                .filter(MANAGED_ROLES::contains)
                .toList();
    }

    private static AdminUserResponse toResponse(UserRepresentation u, List<String> roles) {
        return new AdminUserResponse(
                u.getId(), u.getUsername(), u.getEmail(),
                u.getFirstName(), u.getLastName(),
                Boolean.TRUE.equals(u.isEnabled()),
                attribute(u, BRANCH_ATTR),
                roles);
    }

    private static String attribute(UserRepresentation u, String key) {
        if (u.getAttributes() == null) {
            return null;
        }
        List<String> values = u.getAttributes().get(key);
        return (values == null || values.isEmpty()) ? null : values.get(0);
    }

    /** Create-user request. {@code enabled} defaults to {@code true} when omitted. */
    public record CreateUserRequest(String username, String email, String firstName, String lastName,
                                    String role, String branchCode, String temporaryPassword, Boolean enabled) {
    }

    /** Edit-user request. Every field is optional; only non-null ones are applied. */
    public record UpdateUserRequest(String firstName, String lastName, String email,
                                    String role, String branchCode) {
    }

    /** User view. */
    public record AdminUserResponse(String id, String username, String email, String firstName,
                                    String lastName, boolean enabled, String branchCode, List<String> roles) {
    }
}
