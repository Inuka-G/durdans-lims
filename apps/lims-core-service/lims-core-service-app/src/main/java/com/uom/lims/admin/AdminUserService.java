package com.uom.lims.admin;

import com.uom.lims.exception.BusinessRuleException;
import com.uom.lims.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.keycloak.admin.client.CreatedResponseUtil;
import org.keycloak.admin.client.Keycloak;
import org.keycloak.admin.client.resource.RealmResource;
import org.keycloak.representations.idm.CredentialRepresentation;
import org.keycloak.representations.idm.RoleRepresentation;
import org.keycloak.representations.idm.UserRepresentation;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

import jakarta.ws.rs.core.Response;

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

    private static final String BRANCH_ATTR = "branch";

    private final Keycloak adminKeycloak;

    @Value("${app.keycloak-admin.realm:lims-realm}")
    private String realm;

    private RealmResource realm() {
        return adminKeycloak.realm(realm);
    }

    public List<AdminUserResponse> listUsers() {
        String scope = SecurityUtils.resolveBranchScope(); // null => all (SUPER_ADMIN)
        return realm().users().list().stream()
                .filter(u -> scope == null || scope.equalsIgnoreCase(attribute(u, BRANCH_ATTR)))
                .map(AdminUserService::toResponse)
                .toList();
    }

    public AdminUserResponse createUser(CreateUserRequest request) {
        String scope = SecurityUtils.resolveBranchScope();
        // A branch admin can only create into their own branch; super-admin uses
        // the requested branch.
        String branch = (scope == null) ? request.branchCode() : scope;
        if (branch == null || branch.isBlank()) {
            throw new BusinessRuleException("A branch is required for the new user");
        }

        UserRepresentation user = new UserRepresentation();
        user.setUsername(request.username());
        user.setEmail(request.email());
        user.setFirstName(request.firstName());
        user.setLastName(request.lastName());
        user.setEnabled(true);
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

        if (request.role() != null && !request.role().isBlank()) {
            RoleRepresentation role = realm().roles().get(request.role()).toRepresentation();
            realm().users().get(userId).roles().realmLevel().add(List.of(role));
        }

        return toResponse(realm().users().get(userId).toRepresentation());
    }

    public void setEnabled(String userId, boolean enabled) {
        UserRepresentation user = realm().users().get(userId).toRepresentation();
        if (!SecurityUtils.canAccessBranch(attribute(user, BRANCH_ATTR))) {
            throw new BusinessRuleException("User not found");
        }
        user.setEnabled(enabled);
        realm().users().get(userId).update(user);
    }

    private static AdminUserResponse toResponse(UserRepresentation u) {
        return new AdminUserResponse(
                u.getId(), u.getUsername(), u.getEmail(),
                u.getFirstName(), u.getLastName(),
                Boolean.TRUE.equals(u.isEnabled()),
                attribute(u, BRANCH_ATTR));
    }

    private static String attribute(UserRepresentation u, String key) {
        if (u.getAttributes() == null) {
            return null;
        }
        List<String> values = u.getAttributes().get(key);
        return (values == null || values.isEmpty()) ? null : values.get(0);
    }

    /** Create-user request. */
    public record CreateUserRequest(String username, String email, String firstName, String lastName,
                                    String role, String branchCode, String temporaryPassword) {
    }

    /** User view. */
    public record AdminUserResponse(String id, String username, String email, String firstName,
                                    String lastName, boolean enabled, String branchCode) {
    }
}
