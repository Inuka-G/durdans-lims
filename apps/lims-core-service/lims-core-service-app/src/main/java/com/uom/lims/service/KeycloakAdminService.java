package com.uom.lims.service;

import com.uom.lims.branchuser.BranchUserEntity;
import com.uom.lims.exception.InvalidRequestException;
import jakarta.ws.rs.core.Response;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.keycloak.admin.client.CreatedResponseUtil;
import org.keycloak.admin.client.Keycloak;
import org.keycloak.admin.client.resource.UserResource;
import org.keycloak.admin.client.KeycloakBuilder;
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
@ConditionalOnProperty(name = "app.keycloak-admin.enabled", havingValue = "true", matchIfMissing = true)
public class KeycloakAdminService {

    private final Keycloak keycloak;

    @Value("${app.keycloak-admin.server-url:http://localhost:8081}")
    private String serverUrl;

    @Value("${app.keycloak-admin.realm:lims-realm}")
    private String realm;

    public String createUser(BranchUserEntity entity) {
        UserRepresentation user = new UserRepresentation();
        user.setUsername(entity.getUsername() != null ? entity.getUsername() : entity.getEmail());
        user.setEmail(entity.getEmail());
        user.setFirstName(entity.getFirstName() != null ? entity.getFirstName() : "");
        user.setLastName(entity.getLastName() != null ? entity.getLastName() : "");
        user.setEnabled(entity.getIsActive());

        // Set branch_id attribute
        Map<String, List<String>> attributes = new HashMap<>();
        attributes.put("branch_id", Collections.singletonList(entity.getBranchId()));
        if (entity.getPhone() != null && !entity.getPhone().isEmpty()) {
            attributes.put("phone", Collections.singletonList(entity.getPhone()));
        }
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
        user.setFirstName(entity.getFirstName() != null ? entity.getFirstName() : "");
        user.setLastName(entity.getLastName() != null ? entity.getLastName() : "");
        user.setEnabled(entity.getIsActive());

        Map<String, List<String>> attributes = user.getAttributes();
        if (attributes == null) {
            attributes = new HashMap<>();
        }
        attributes.put("branch_id", Collections.singletonList(entity.getBranchId()));
        if (entity.getPhone() != null && !entity.getPhone().isEmpty()) {
            attributes.put("phone", Collections.singletonList(entity.getPhone()));
        } else {
            attributes.remove("phone");
        }
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
            log.warn("Could not assign role {} to Keycloak user {}: {}", roleName, userId, e.getMessage());
        }
    }

    private void syncRoles(String userId, String expectedRole) {
        if (expectedRole == null || expectedRole.trim().isEmpty()) {
            return;
        }

        UserResource userResource = keycloak.realm(realm).users().get(userId);
        List<RoleRepresentation> currentRoles = userResource.roles().realmLevel().listAll();

        java.util.Set<String> targetRoles = java.util.Arrays.stream(expectedRole.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(java.util.stream.Collectors.toSet());

        // Remove old non-default roles that are not in targetRoles
        for (RoleRepresentation role : currentRoles) {
            String roleName = role.getName();
            if (roleName.startsWith("default-roles") || roleName.equals("offline_access") || roleName.equals("uma_authorization")) {
                continue;
            }
            boolean shouldKeep = targetRoles.stream().anyMatch(t -> t.equalsIgnoreCase(roleName));
            if (!shouldKeep) {
                try {
                    userResource.roles().realmLevel().remove(Collections.singletonList(role));
                    log.info("Removed role {} from user {}", roleName, userId);
                } catch (Exception e) {
                    log.warn("Failed to remove role {} from user {}: {}", roleName, userId, e.getMessage());
                }
            }
        }

        // Add new target roles that user doesn't have yet
        for (String targetRole : targetRoles) {
            boolean alreadyHas = currentRoles.stream().anyMatch(r -> r.getName().equalsIgnoreCase(targetRole));
            if (!alreadyHas) {
                assignRole(userId, targetRole);
            }
        }
    }

    public List<UserRepresentation> getUsersByBranch(String branchId) {
        return getUsersByBranch(Collections.singletonList(branchId));
    }

    public List<UserRepresentation> getUsersByBranch(java.util.Collection<String> branchIdentifiers) {
        List<UserRepresentation> allUsers = keycloak.realm(realm).users().list();
        java.util.Set<String> lowerIdentifiers = branchIdentifiers.stream()
                .filter(java.util.Objects::nonNull)
                .map(String::toLowerCase)
                .collect(java.util.stream.Collectors.toSet());

        return allUsers.stream()
                .filter(u -> {
                    if (u.getAttributes() == null || !u.getAttributes().containsKey("branch_id")) return false;
                    return u.getAttributes().get("branch_id").stream()
                            .anyMatch(id -> id != null && lowerIdentifiers.contains(id.toLowerCase()));
                })
                .toList();
    }

    public List<UserRepresentation> getAllUsers() {
        return keycloak.realm(realm).users().list();
    }

    public UserRepresentation getUser(String userId) {
        return keycloak.realm(realm).users().get(userId).toRepresentation();
    }

    public List<String> getUserRoles(String userId) {
        try {
            return keycloak.realm(realm).users().get(userId).roles().realmLevel().listAll()
                    .stream()
                    .map(RoleRepresentation::getName)
                    .filter(name -> !name.startsWith("default-roles") && !name.equals("offline_access") && !name.equals("uma_authorization"))
                    .toList();
        } catch (Exception e) {
            log.error("Failed to fetch roles for user {}", userId, e);
            return Collections.emptyList();
        }
    }

    public void updateUserDirectly(String userId, String fullName, String email, String phone, String branchId, String role, boolean isActive) {
        UserResource userResource = keycloak.realm(realm).users().get(userId);
        UserRepresentation user = userResource.toRepresentation();

        user.setEmail(email);
        if (fullName != null) {
            String[] parts = fullName.trim().split("\\s+", 2);
            user.setFirstName(parts[0]);
            user.setLastName(parts.length > 1 ? parts[1] : "");
        } else {
            user.setFirstName("");
            user.setLastName("");
        }
        user.setEnabled(isActive);

        Map<String, List<String>> attributes = user.getAttributes();
        if (attributes == null) {
            attributes = new HashMap<>();
        }
        if (branchId != null && !branchId.trim().isEmpty()) {
            attributes.put("branch_id", Collections.singletonList(branchId));
        } else {
            attributes.remove("branch_id");
        }
        if (phone != null && !phone.trim().isEmpty()) {
            attributes.put("phone", Collections.singletonList(phone));
        } else {
            attributes.remove("phone");
        }
        user.setAttributes(attributes);

        userResource.update(user);

        syncRoles(userId, role);
        log.info("Directly updated user in Keycloak with ID: {}", userId);
    }

    public List<String> getAllRoles() {
        return keycloak.realm(realm).roles().list().stream()
                .map(RoleRepresentation::getName)
                .filter(name -> !name.startsWith("default-roles") && !name.equals("offline_access") && !name.equals("uma_authorization"))
                .toList();
    }

    public void resetUserPassword(String userId, String newPassword) {
        CredentialRepresentation credential = new CredentialRepresentation();
        credential.setType(CredentialRepresentation.PASSWORD);
        credential.setValue(newPassword);
        credential.setTemporary(true);
        
        keycloak.realm(realm).users().get(userId).resetPassword(credential);
        log.info("Reset password for user in Keycloak with ID: {}", userId);
    }
    
    public UserRepresentation getUserById(String userId) {
        return keycloak.realm(realm).users().get(userId).toRepresentation();
    }

    public void verifyUserPassword(String username, String password) {
        try {
            Keycloak tempKeycloak = KeycloakBuilder.builder()
                    .serverUrl(serverUrl)
                    .realm(realm)
                    .grantType(org.keycloak.OAuth2Constants.PASSWORD)
                    .clientId("admin-cli") // admin-cli inherently supports direct access grants in Keycloak
                    .username(username)
                    .password(password)
                    .build();
            
            // This will throw NotAuthorizedException if credentials are bad
            tempKeycloak.tokenManager().getAccessToken();
        } catch (jakarta.ws.rs.NotAuthorizedException e) {
            throw new InvalidRequestException("Incorrect admin password. Verification failed.");
        } catch (Exception e) {
            log.error("Error verifying admin password", e);
            throw new InvalidRequestException("Failed to verify admin password due to an internal error.");
        }
    }
}
