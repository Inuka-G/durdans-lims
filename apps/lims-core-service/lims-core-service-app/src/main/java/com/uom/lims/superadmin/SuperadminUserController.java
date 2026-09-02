package com.uom.lims.superadmin;

import com.uom.lims.api.superadmin.SuperadminUserApi;
import com.uom.lims.api.superadmin.dto.SuperadminUserResponse;
import com.uom.lims.service.KeycloakAdminService;
import lombok.RequiredArgsConstructor;
import org.keycloak.representations.idm.UserRepresentation;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.stream.Collectors;

import com.uom.lims.api.superadmin.dto.ResetPasswordRequest;
import com.uom.lims.api.superadmin.dto.SuperadminUserUpdateRequest;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import java.util.Collections;
import com.uom.lims.metadata.BranchRepository;
import com.uom.lims.entity.BranchEntity;

/**
 * Global user control. Every method reaches straight into Keycloak, so each one
 * is gated on SUPER_ADMIN: without these, /api/v1/superadmin/** only matched the
 * catch-all `.authenticated()` rule in SecurityConfig, which would have let any
 * logged-in user — a receptionist, a patient — enumerate the directory and reset
 * another account's password.
 */
@RestController
@RequiredArgsConstructor
@PreAuthorize("hasRole('SUPER_ADMIN')")
@ConditionalOnProperty(name = "app.keycloak-admin.enabled", havingValue = "true")
public class SuperadminUserController implements SuperadminUserApi {

    private final KeycloakAdminService keycloakAdminService;
    private final com.uom.lims.audit.AuditService auditService;
    private final BranchRepository branchRepository;

    @Override
    public List<SuperadminUserResponse> getAllUsers() {
        return keycloakAdminService.getAllUsers().stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Override
    public SuperadminUserResponse updateSuperadminUser(String id, SuperadminUserUpdateRequest request) {
        if (request.getBranchId() != null && !request.getBranchId().isBlank()) {
            BranchEntity branchEntity = branchRepository.findById(java.util.UUID.fromString(request.getBranchId()))
                    .orElseThrow(() -> new RuntimeException("Branch not found: " + request.getBranchId()));
            if (!"Active".equalsIgnoreCase(branchEntity.getStatus())) {
                throw new RuntimeException("Users can only be created or assigned to active branches.");
            }
        }

        // Fetch old state before updating
        UserRepresentation oldUser = keycloakAdminService.getUser(id);
        String oldEmail = oldUser.getEmail();
        List<String> oldRoles = keycloakAdminService.getUserRoles(id);
        String oldRole = oldRoles != null && !oldRoles.isEmpty() ? oldRoles.get(0) : "USER";
        boolean oldIsActive = oldUser.isEnabled() != null ? oldUser.isEnabled() : false;

        keycloakAdminService.updateUserDirectly(id, request.getFullName(), request.getEmail(), request.getPhone(), request.getBranchId(),
                request.getRole(), request.getIsActive());

        // Build a details string containing the old to new transition
        String details = String.format(
                "{\"email\":{\"old\":\"%s\", \"new\":\"%s\"}, \"role\":{\"old\":\"%s\", \"new\":\"%s\"}, \"isActive\":{\"old\":%b, \"new\":%b}}",
                oldEmail != null ? oldEmail : "", request.getEmail() != null ? request.getEmail() : "",
                oldRole, request.getRole() != null ? request.getRole() : "",
                oldIsActive, request.getIsActive() != null ? request.getIsActive() : false);

        auditService.writeStandalone("UPDATE_SUPERADMIN_USER", "USER", java.util.UUID.fromString(id), null, details,
                getCurrentIp());

        // Return updated user object
        UserRepresentation updatedUser = keycloakAdminService.getUser(id);
        return mapToResponse(updatedUser);
    }

    // Widened from the class-level rule: the branch staff create/edit dialogs
    // populate their role dropdown from here, so a BRANCH_ADMIN needs to read it.
    @Override
    @PreAuthorize("hasAnyRole('BRANCH_ADMIN','SUPER_ADMIN')")
    public List<String> getRoles() {
        return keycloakAdminService.getAllRoles();
    }

    @Override
    public void resetUserPassword(String id, ResetPasswordRequest request) {
        // Extract current superadmin's username from the security context
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        String currentUsername = null;
        if (principal instanceof Jwt) {
            currentUsername = ((Jwt) principal).getClaimAsString("preferred_username");
        }

        if (currentUsername == null) {
            throw new RuntimeException("Unable to determine current superadmin username.");
        }

        // Verify the admin's password before proceeding
        keycloakAdminService.verifyUserPassword(currentUsername, request.getAdminPassword());

        keycloakAdminService.resetUserPassword(id, request.getPassword());

        auditService.writeStandalone("RESET_SUPERADMIN_PASSWORD", "USER", java.util.UUID.fromString(id), null, "{}",
                getCurrentIp());
    }

    private SuperadminUserResponse mapToResponse(UserRepresentation user) {
        String branchId = null;
        if (user.getAttributes() != null && user.getAttributes().containsKey("branch_id")) {
            List<String> branchIdAttr = user.getAttributes().get("branch_id");
            if (branchIdAttr != null && !branchIdAttr.isEmpty()) {
                branchId = branchIdAttr.get(0);
            }
        }

        String phone = null;
        if (user.getAttributes() != null && user.getAttributes().containsKey("phone")) {
            List<String> phoneAttr = user.getAttributes().get("phone");
            if (phoneAttr != null && !phoneAttr.isEmpty()) {
                phone = phoneAttr.get(0);
            }
        }

        return SuperadminUserResponse.builder()
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .fullName(user.getFirstName() + (user.getLastName() != null ? " " + user.getLastName() : ""))
                .isActive(user.isEnabled() != null ? user.isEnabled() : false)
                .branchId(branchId)
                .roles(keycloakAdminService.getUserRoles(user.getId()))
                .phone(phone)
                .build();
    }

    private String getCurrentIp() {
        try {
            return com.uom.lims.security.ClientIpResolver.resolve(
                    ((org.springframework.web.context.request.ServletRequestAttributes) org.springframework.web.context.request.RequestContextHolder
                            .currentRequestAttributes()).getRequest());
        } catch (Exception e) {
            return "SYSTEM";
        }
    }
}
