package com.uom.lims.superadmin;

import com.uom.lims.api.superadmin.SuperadminUserApi;
import com.uom.lims.api.superadmin.dto.SuperadminUserResponse;
import com.uom.lims.service.KeycloakAdminService;
import lombok.RequiredArgsConstructor;
import org.keycloak.representations.idm.UserRepresentation;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.stream.Collectors;

import com.uom.lims.api.superadmin.dto.ResetPasswordRequest;
import com.uom.lims.api.superadmin.dto.SuperadminUserUpdateRequest;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import java.util.Collections;

@RestController
@RequiredArgsConstructor
public class SuperadminUserController implements SuperadminUserApi {

    private final KeycloakAdminService keycloakAdminService;

    @Override
    public List<SuperadminUserResponse> getAllUsers() {
        return keycloakAdminService.getAllUsers().stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Override
    public SuperadminUserResponse updateSuperadminUser(String id, SuperadminUserUpdateRequest request) {
        keycloakAdminService.updateUserDirectly(id, request.getFullName(), request.getEmail(), request.getBranchId(), request.getRole(), request.getIsActive());
        
        // Return updated user object
        UserRepresentation updatedUser = keycloakAdminService.getUser(id);
        return mapToResponse(updatedUser);
    }

    @Override
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
    }

    private SuperadminUserResponse mapToResponse(UserRepresentation user) {
        String branchId = null;
        if (user.getAttributes() != null && user.getAttributes().containsKey("branch_id")) {
            List<String> branchIdAttr = user.getAttributes().get("branch_id");
            if (branchIdAttr != null && !branchIdAttr.isEmpty()) {
                branchId = branchIdAttr.get(0);
            }
        }

        return SuperadminUserResponse.builder()
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .fullName(user.getFirstName()) // we stored full name in firstName
                .isActive(user.isEnabled() != null ? user.isEnabled() : false)
                .branchId(branchId)
                .roles(keycloakAdminService.getUserRoles(user.getId()))
                .build();
    }
}
