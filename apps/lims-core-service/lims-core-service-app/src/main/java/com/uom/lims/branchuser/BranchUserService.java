package com.uom.lims.branchuser;

import com.uom.lims.api.branchuser.dto.request.BranchUserCreateRequest;
import com.uom.lims.api.branchuser.dto.request.BranchUserUpdateRequest;
import com.uom.lims.api.branchuser.dto.response.BranchUserResponse;
import com.uom.lims.exception.InvalidRequestException;
import com.uom.lims.exception.ResourceNotFoundException;
import com.uom.lims.audit.AuditService;
import com.uom.lims.security.SecurityUtils;
import com.uom.lims.service.KeycloakAdminService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@Transactional
@RequiredArgsConstructor
public class BranchUserService {

    private final BranchUserRepository repository;
    private final ObjectProvider<KeycloakAdminService> keycloakAdminServiceProvider;
    private final AuditService auditService;

    public BranchUserResponse createBranchUser(BranchUserCreateRequest request) {
        // Simple context check (e.g., must be a SUPER_ADMIN or BRANCH_ADMIN for this branch)
        String currentUserBranchId = SecurityUtils.getCurrentBranchId();
        if (!SecurityUtils.hasRole("SUPER_ADMIN") && !request.getBranchId().equalsIgnoreCase(currentUserBranchId)) {
            throw new InvalidRequestException("You don't have permission to access users of this branch");
        }

        if (repository.existsByEmail(request.getEmail())) {
            throw new InvalidRequestException("User with this email already exists");
        }

        if (request.getUsername() != null && repository.existsByUsername(request.getUsername())) {
            throw new InvalidRequestException("User with this username already exists");
        }

        BranchUserEntity entity = new BranchUserEntity();
        entity.setBranchId(request.getBranchId());
        
        String fullName = (request.getFirstName() != null ? request.getFirstName().trim() : "") 
                + " " + (request.getLastName() != null ? request.getLastName().trim() : "");
        entity.setFullName(fullName.trim());
        entity.setFirstName(request.getFirstName() != null ? request.getFirstName().trim() : "");
        entity.setLastName(request.getLastName() != null ? request.getLastName().trim() : "");
        entity.setEmail(request.getEmail());
        entity.setPhone(request.getPhone());
        entity.setRole(request.getRole());
        entity.setIsActive(request.getIsActive());
        entity.setUsername(request.getUsername());

        // Create in Keycloak if enabled
        keycloakAdminServiceProvider.ifAvailable(service -> {
            String keycloakId = service.createUser(entity);
            entity.setKeycloakId(keycloakId);
        });

        BranchUserEntity savedEntity = repository.save(entity);
        
        String details = String.format("{\"email\":\"%s\", \"username\":\"%s\", \"role\":\"%s\"}", savedEntity.getEmail(), savedEntity.getUsername(), savedEntity.getRole());
        auditService.log("CREATE_BRANCH_USER", "BRANCH_USER", savedEntity.getId(), null, details, getCurrentIp());

        return mapToResponse(savedEntity);
    }

    @Transactional(readOnly = true)
    public BranchUserResponse getBranchUserById(String id) {
        BranchUserEntity entity = repository.findByKeycloakId(id)
                .orElseThrow(() -> new ResourceNotFoundException("BranchUser not found with id: " + id));
        validateBranchAccess(entity.getBranchId());
        return mapToResponse(entity);
    }

    @Transactional(readOnly = true)
    public Page<BranchUserResponse> searchBranchUsers(String branchId, String keyword, Boolean isActive, Pageable pageable) {
        if (!SecurityUtils.hasRole("SUPER_ADMIN")) {
            branchId = SecurityUtils.getCurrentBranchId(); // Enforce branch context
        }

        final String finalBranchId = branchId;
        List<BranchUserResponse> responses = new java.util.ArrayList<>();
        
        // Pre-fetch local phone numbers as a fallback since old users might not have phone saved in Keycloak
        java.util.List<BranchUserEntity> localUsers = repository.findByBranchId(finalBranchId);
        java.util.Map<String, String> localPhoneMap = localUsers.stream()
            .filter(u -> u.getKeycloakId() != null && u.getPhone() != null)
            .collect(java.util.stream.Collectors.toMap(BranchUserEntity::getKeycloakId, BranchUserEntity::getPhone, (p1, p2) -> p1));

        keycloakAdminServiceProvider.ifAvailable(service -> {
            List<org.keycloak.representations.idm.UserRepresentation> kcUsers = service.getUsersByBranch(finalBranchId);
            
            for (org.keycloak.representations.idm.UserRepresentation user : kcUsers) {
                // Filter by keyword
                if (keyword != null && !keyword.trim().isEmpty()) {
                    String lowerKeyword = keyword.toLowerCase();
                    boolean matches = false;
                    if (user.getFirstName() != null && user.getFirstName().toLowerCase().contains(lowerKeyword)) matches = true;
                    if (user.getLastName() != null && user.getLastName().toLowerCase().contains(lowerKeyword)) matches = true;
                    if (user.getEmail() != null && user.getEmail().toLowerCase().contains(lowerKeyword)) matches = true;
                    if (user.getUsername() != null && user.getUsername().toLowerCase().contains(lowerKeyword)) matches = true;
                    if (!matches) continue;
                }
                
                // Filter by isActive
                if (isActive != null) {
                    boolean userActive = Boolean.TRUE.equals(user.isEnabled());
                    if (userActive != isActive) continue;
                }
                
                // Fetch roles and filter out BRANCH_ADMIN
                List<String> roles = service.getUserRoles(user.getId());
                if (roles.contains("BRANCH_ADMIN") || roles.contains("ROLE_BRANCH_ADMIN")) {
                    continue;
                }
                
                BranchUserResponse mappedResponse = mapToResponse(user, finalBranchId, roles);
                if (mappedResponse.getPhone() == null || mappedResponse.getPhone().isEmpty()) {
                    mappedResponse.setPhone(localPhoneMap.get(user.getId()));
                }
                responses.add(mappedResponse);
            }
        });

        // In-memory pagination
        int start = (int) pageable.getOffset();
        int end = Math.min((start + pageable.getPageSize()), responses.size());
        List<BranchUserResponse> pageContent = new java.util.ArrayList<>();
        if (start <= end) {
            pageContent = responses.subList(start, end);
        }

        return new org.springframework.data.domain.PageImpl<>(pageContent, pageable, responses.size());
    }

    public BranchUserResponse updateBranchUser(String id, BranchUserUpdateRequest request) {
        BranchUserEntity entity = repository.findByKeycloakId(id).orElse(null);
        if (entity == null) {
            entity = new BranchUserEntity();
            entity.setKeycloakId(id);
            String branchId = SecurityUtils.getCurrentBranchId();
            KeycloakAdminService kcService = keycloakAdminServiceProvider.getIfAvailable();
            if (SecurityUtils.hasRole("SUPER_ADMIN") && kcService != null) {
                try {
                    org.keycloak.representations.idm.UserRepresentation kcUser = kcService.getUserById(id);
                    if (kcUser.getAttributes() != null && kcUser.getAttributes().containsKey("branch_id")) {
                        branchId = kcUser.getAttributes().get("branch_id").get(0);
                    }
                } catch (Exception e) {
                    log.warn("Could not fetch user branch from Keycloak for id {}", id, e);
                }
            }
            entity.setBranchId(branchId);
            entity.setIsActive(true); // default
        }
        
        validateBranchAccess(entity.getBranchId());

        if (repository.existsByEmailAndIdNot(request.getEmail(), entity.getId())) {
            throw new InvalidRequestException("User with this email already exists");
        }

        if (request.getUsername() != null && repository.existsByUsernameAndIdNot(request.getUsername(), entity.getId())) {
            throw new InvalidRequestException("User with this username already exists");
        }

        String oldEmail = entity.getEmail() != null ? entity.getEmail() : "";
        String oldUsername = entity.getUsername() != null ? entity.getUsername() : "";
        String oldRole = entity.getRole() != null ? entity.getRole() : "";
        boolean wasActive = entity.getId() != null ? Boolean.TRUE.equals(entity.getIsActive()) : false;

        String fullName = (request.getFirstName() != null ? request.getFirstName().trim() : "") 
                + " " + (request.getLastName() != null ? request.getLastName().trim() : "");
        entity.setFullName(fullName.trim());
        entity.setFirstName(request.getFirstName() != null ? request.getFirstName().trim() : "");
        entity.setLastName(request.getLastName() != null ? request.getLastName().trim() : "");
        entity.setEmail(request.getEmail());
        entity.setPhone(request.getPhone());
        entity.setRole(request.getRole());
        entity.setIsActive(request.getIsActive());
        entity.setUsername(request.getUsername());

        // Update in Keycloak if enabled
        final BranchUserEntity finalEntity = entity;
        keycloakAdminServiceProvider.ifAvailable(service -> service.updateUser(finalEntity));

        BranchUserEntity savedEntity = repository.save(entity);
        
        String details = String.format("{\"isActive\":{\"old\":%b,\"new\":%b},\"role\":{\"old\":\"%s\",\"new\":\"%s\"},\"email\":{\"old\":\"%s\",\"new\":\"%s\"},\"username\":{\"old\":\"%s\",\"new\":\"%s\"}}",
                wasActive, savedEntity.getIsActive() != null ? savedEntity.getIsActive() : false,
                oldRole, savedEntity.getRole() != null ? savedEntity.getRole() : "",
                oldEmail, savedEntity.getEmail() != null ? savedEntity.getEmail() : "",
                oldUsername, savedEntity.getUsername() != null ? savedEntity.getUsername() : "");
        
        boolean isActiveNow = Boolean.TRUE.equals(savedEntity.getIsActive());
        if (wasActive && !isActiveNow) {
            auditService.log("DISABLE_BRANCH_USER", "BRANCH_USER", savedEntity.getId(), null, details, getCurrentIp());
        } else if (!wasActive && isActiveNow) {
            auditService.log("ENABLE_BRANCH_USER", "BRANCH_USER", savedEntity.getId(), null, details, getCurrentIp());
        } else {
            auditService.log("UPDATE_BRANCH_USER", "BRANCH_USER", savedEntity.getId(), null, details, getCurrentIp());
        }

        return mapToResponse(savedEntity);
    }

    public void deleteBranchUser(String id) {
        BranchUserEntity entity = repository.findByKeycloakId(id).orElse(null);
        
        if (entity != null) {
            validateBranchAccess(entity.getBranchId());
            keycloakAdminServiceProvider.ifAvailable(service -> service.deleteUser(entity.getKeycloakId()));
            repository.delete(entity);
            
            String details = String.format("{\"email\":\"%s\", \"username\":\"%s\"}", entity.getEmail(), entity.getUsername());
            auditService.log("DELETE_BRANCH_USER", "BRANCH_USER", entity.getId(), null, details, getCurrentIp());
        } else {
            // Delete from Keycloak if it exists there
            keycloakAdminServiceProvider.ifAvailable(service -> service.deleteUser(id));
        }
    }

    private String getCurrentIp() {
        try {
            org.springframework.web.context.request.RequestAttributes attribs = org.springframework.web.context.request.RequestContextHolder.getRequestAttributes();
            if (attribs instanceof org.springframework.web.context.request.ServletRequestAttributes) {
                jakarta.servlet.http.HttpServletRequest request = ((org.springframework.web.context.request.ServletRequestAttributes) attribs).getRequest();
                return com.uom.lims.security.ClientIpResolver.resolve(request);
            }
        } catch (Exception e) {
            log.warn("Could not determine client IP", e);
        }
        return "UNKNOWN";
    }

    private void validateBranchAccess(String entityBranchId) {
        if (!SecurityUtils.hasRole("SUPER_ADMIN") && !entityBranchId.equalsIgnoreCase(SecurityUtils.getCurrentBranchId())) {
            throw new InvalidRequestException("You do not have access to this branch user");
        }
    }

    private BranchUserResponse mapToResponse(BranchUserEntity entity) {
        BranchUserResponse response = new BranchUserResponse();
        response.setId(entity.getId() != null ? entity.getId().toString() : null);
        response.setBranchId(entity.getBranchId());
        response.setKeycloakId(entity.getKeycloakId());
        if (entity.getFullName() != null) {
            String[] parts = entity.getFullName().trim().split("\\s+", 2);
            response.setFirstName(parts[0]);
            response.setLastName(parts.length > 1 ? parts[1] : "");
        } else {
            response.setFirstName("");
            response.setLastName("");
        }
        response.setEmail(entity.getEmail());
        response.setPhone(entity.getPhone());
        response.setRole(entity.getRole());
        response.setIsActive(entity.getIsActive());
        response.setUsername(entity.getUsername());
        response.setCreatedAt(entity.getCreatedAt());
        response.setUpdatedAt(entity.getLastModifiedAt());
        
        // Mock UI fields
        response.setInitials(getInitials(entity.getFullName()));
        response.setBgColor("bg-blue-100");
        response.setTextColor("text-blue-600");
        response.setLastLogin("Never");
        
        return response;
    }

    private BranchUserResponse mapToResponse(org.keycloak.representations.idm.UserRepresentation user, String branchId, List<String> roles) {
        BranchUserResponse response = new BranchUserResponse();
        response.setId(user.getId());
        response.setKeycloakId(user.getId());
        response.setBranchId(branchId);
        
        String firstName = user.getFirstName() != null ? user.getFirstName() : "";
        String lastName = user.getLastName() != null ? user.getLastName() : "";
        
        if (firstName.isBlank() && lastName.isBlank()) {
            firstName = user.getUsername();
        }
        response.setFirstName(firstName);
        response.setLastName(lastName);
        response.setEmail(user.getEmail() != null ? user.getEmail() : user.getUsername() + "@example.com");
        
        String role = roles.isEmpty() ? "BRANCH_USER" : roles.get(0);
        response.setRole(role);
        
        response.setIsActive(Boolean.TRUE.equals(user.isEnabled()));
        response.setUsername(user.getUsername());
        
        if (user.getAttributes() != null && user.getAttributes().containsKey("phone")) {
            response.setPhone(user.getAttributes().get("phone").get(0));
        }
        
        response.setInitials(getInitials(firstName + " " + lastName));
        response.setBgColor("bg-blue-100");
        response.setTextColor("text-blue-600");
        response.setLastLogin("Never");
        return response;
    }

    private String getInitials(String name) {
        if (name == null || name.isBlank()) return "U";
        String[] parts = name.trim().split("\\s+");
        if (parts.length > 1) {
            return (parts[0].substring(0, 1) + parts[1].substring(0, 1)).toUpperCase();
        }
        return name.substring(0, Math.min(2, name.length())).toUpperCase();
    }

    @Transactional
    public void syncFromKeycloak(String branchId) {
        // 1. Delete all users from local DB
        repository.deleteAll();

        // 2. Fetch from keycloak and save
        keycloakAdminServiceProvider.ifAvailable(service -> {
            List<org.keycloak.representations.idm.UserRepresentation> kcUsers = service.getUsersByBranch(branchId);
            for (org.keycloak.representations.idm.UserRepresentation kcUser : kcUsers) {
                BranchUserEntity entity = new BranchUserEntity();
                entity.setBranchId(branchId);
                entity.setKeycloakId(kcUser.getId());
                entity.setFullName(kcUser.getFirstName() != null ? kcUser.getFirstName() + " " + (kcUser.getLastName() != null ? kcUser.getLastName() : "") : kcUser.getUsername());
                entity.setEmail(kcUser.getEmail() != null ? kcUser.getEmail() : kcUser.getUsername() + "@example.com");
                entity.setRole("BRANCH_ADMIN"); // default fallback
                entity.setIsActive(Boolean.TRUE.equals(kcUser.isEnabled()));
                entity.setUsername(kcUser.getUsername());
                
                repository.save(entity);
                log.info("Synced user {} from Keycloak to local DB", kcUser.getUsername());
            }
        });
    }
    public void resetUserPassword(String targetUserId, com.uom.lims.api.superadmin.dto.ResetPasswordRequest request) {
        // Enforce branch context - target user must belong to current admin's branch
        if (!SecurityUtils.hasRole("SUPER_ADMIN")) {
            String currentBranchId = SecurityUtils.getCurrentBranchId();
            keycloakAdminServiceProvider.ifAvailable(service -> {
                org.keycloak.representations.idm.UserRepresentation user = service.getUser(targetUserId);
                if (user.getAttributes() == null || !user.getAttributes().containsKey("branch_id") ||
                        !user.getAttributes().get("branch_id").contains(currentBranchId)) {
                    throw new InvalidRequestException("You do not have access to reset password for this user");
                }
            });
        }

        // Extract current admin's username from the security context
        org.springframework.security.core.Authentication auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        String currentUsername = null;
        if (auth.getPrincipal() instanceof org.springframework.security.oauth2.jwt.Jwt) {
            currentUsername = ((org.springframework.security.oauth2.jwt.Jwt) auth.getPrincipal()).getClaimAsString("preferred_username");
        }

        if (currentUsername == null) {
            throw new RuntimeException("Unable to determine current admin username.");
        }

        // Verify the admin's password before proceeding
        final String finalCurrentUsername = currentUsername;
        keycloakAdminServiceProvider.ifAvailable(service -> {
            service.verifyUserPassword(finalCurrentUsername, request.getAdminPassword());
            service.resetUserPassword(targetUserId, request.getPassword());
        });

        auditService.writeStandalone("RESET_BRANCH_USER_PASSWORD", "USER", java.util.UUID.fromString(targetUserId), null, "{}",
                getCurrentIp());
    }
}
