package com.uom.lims.service;

import com.uom.lims.branchuser.BranchUserEntity;
import com.uom.lims.exception.InvalidRequestException;
import jakarta.ws.rs.core.Response;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.keycloak.admin.client.CreatedResponseUtil;
import org.keycloak.admin.client.Keycloak;
import org.keycloak.admin.client.resource.UserResource;
import org.keycloak.representations.idm.CredentialRepresentation;
import org.keycloak.representations.idm.RoleRepresentation;
import org.keycloak.representations.idm.UserRepresentation;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = "app.keycloak-admin.enabled", havingValue = "true")
public class KeycloakAdminService {

    private final Keycloak keycloak;

    @Value("${app.keycloak-admin.realm:lims-realm}")
    private String realm;

    public String createUser(BranchUserEntity entity) {
        UserRepresentation user = new UserRepresentation();
        user.setUsername(entity.getUsername() != null ? entity.getUsername() : entity.getEmail());
        user.setEmail(entity.getEmail());
        user.setFirstName(entity.getFullName());
        user.setEnabled(entity.getIsActive());

        // Set branch_id attribute
        Map<String, List<String>> attributes = new HashMap<>();
        attributes.put("branch_id", Collections.singletonList(entity.getBranchId()));
        user.setAttributes(attributes);

        // Require password update on first login
        user.setRequiredActions(Collections.singletonList("UPDATE_PASSWORD"));

        // Set default password
        CredentialRepresentation credential = new CredentialRepresentation();
        credential.setType(CredentialRepresentation.PASSWORD);
        credential.setValue("admin");
        credential.setTemporary(false); // UPDATE_PASSWORD action handles the requirement to change it
        user.setCredentials(Collections.singletonList(credential));

        Response response = keycloak.realm(realm).users().create(user);
        
        if (response.getStatus() != 201) {
            log.error("Failed to create user in Keycloak. Status: {}, Info: {}", response.getStatus(), response.getStatusInfo());
            throw new InvalidRequestException("Failed to create user in authentication server.");
        }

        String userId = CreatedResponseUtil.getCreatedId(response);
        log.info("Created user in Keycloak with ID: {}", userId);

        // Assign realm role
        assignRole(userId, entity.getRole());

        return userId;
    }

    public void updateUser(BranchUserEntity entity) {
        if (entity.getKeycloakId() == null) {
            log.warn("Cannot update Keycloak user for BranchUser {} because keycloakId is null", entity.getId());
            return;
        }

        UserResource userResource = keycloak.realm(realm).users().get(entity.getKeycloakId());
        UserRepresentation user = userResource.toRepresentation();
        
        user.setUsername(entity.getUsername() != null ? entity.getUsername() : entity.getEmail());
        user.setEmail(entity.getEmail());
        user.setFirstName(entity.getFullName());
        user.setEnabled(entity.getIsActive());

        Map<String, List<String>> attributes = user.getAttributes();
        if (attributes == null) {
            attributes = new HashMap<>();
        }
        attributes.put("branch_id", Collections.singletonList(entity.getBranchId()));
        user.setAttributes(attributes);

        userResource.update(user);

        // Sync roles
        syncRoles(entity.getKeycloakId(), entity.getRole());
        
        log.info("Updated user in Keycloak with ID: {}", entity.getKeycloakId());
    }

    public void deleteUser(String keycloakId) {
        if (keycloakId == null) {
            return;
        }
        try {
            Response response = keycloak.realm(realm).users().delete(keycloakId);
            if (response.getStatus() >= 400 && response.getStatus() != 404) {
                log.error("Failed to delete user in Keycloak. Status: {}", response.getStatus());
                throw new InvalidRequestException("Failed to delete user in authentication server.");
            }
            log.info("Deleted user in Keycloak with ID: {}", keycloakId);
        } catch (Exception e) {
            log.error("Error deleting user from Keycloak", e);
            throw new InvalidRequestException("Error deleting user from authentication server.");
        }
    }

    private void assignRole(String userId, String roleName) {
        if (roleName == null || roleName.trim().isEmpty()) {
            return;
        }
        try {
            RoleRepresentation realmRole = keycloak.realm(realm).roles().get(roleName).toRepresentation();
            keycloak.realm(realm).users().get(userId).roles().realmLevel().add(Collections.singletonList(realmRole));
        } catch (Exception e) {
            log.error("Failed to assign role {} to user {}", roleName, userId, e);
            throw new InvalidRequestException("Failed to assign role in authentication server.");
        }
    }

    private void syncRoles(String userId, String expectedRole) {
        UserResource userResource = keycloak.realm(realm).users().get(userId);
        List<RoleRepresentation> currentRoles = userResource.roles().realmLevel().listAll();

        boolean hasExpectedRole = false;
        
        for (RoleRepresentation role : currentRoles) {
            // Ignore default roles if they exist, only manage our application roles
            // For simplicity, we remove roles that don't match the expected role
            if (role.getName().equals(expectedRole)) {
                hasExpectedRole = true;
            } else if (!role.getName().startsWith("default-roles")) {
                // Remove unwanted role
                try {
                    userResource.roles().realmLevel().remove(Collections.singletonList(role));
                } catch (Exception e) {
                    log.warn("Failed to remove role {} from user {}", role.getName(), userId);
                }
            }
        }

        if (!hasExpectedRole && expectedRole != null && !expectedRole.trim().isEmpty()) {
            assignRole(userId, expectedRole);
        }
    }

    public List<UserRepresentation> getUsersByBranch(String branchId) {
        // Fetch all users and filter by attribute (Keycloak search by attribute is supported in some versions, 
        // but filtering in memory is safer if the number of users is small, or we can use exact search).
        // Since admin client search by custom attributes is sometimes tricky (q="branch_id:COL-1"), 
        // let's fetch all users in realm and filter.
        List<UserRepresentation> allUsers = keycloak.realm(realm).users().list();
        return allUsers.stream()
                .filter(u -> u.getAttributes() != null 
                        && u.getAttributes().containsKey("branch_id")
                        && u.getAttributes().get("branch_id").contains(branchId))
                .toList();
    }
}
