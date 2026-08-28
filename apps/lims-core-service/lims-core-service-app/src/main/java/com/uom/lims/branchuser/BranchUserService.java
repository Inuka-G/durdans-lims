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
        String userBranchCode = SecurityUtils.getCurrentBranchId();
        if (!SecurityUtils.hasRole("SUPER_ADMIN") && !request.getBranchId().equals(userBranchCode)) {
            throw new InvalidRequestException("You can only create users in your own branch");
        }

        if (repository.existsByEmail(request.getEmail())) {
            throw new InvalidRequestException("User with this email already exists");
        }

        if (request.getUsername() != null && repository.existsByUsername(request.getUsername())) {
            throw new InvalidRequestException("User with this username already exists");
        }

        BranchUserEntity entity = new BranchUserEntity();
        entity.setBranchId(request.getBranchId());
        entity.setFullName(request.getFullName());
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
        BranchUserEntity entity = repository.findById(java.util.UUID.fromString(id))
                .orElseThrow(() -> new ResourceNotFoundException("BranchUser not found with id: " + id));
        validateBranchAccess(entity.getBranchId());
        return mapToResponse(entity);
    }

    @Transactional(readOnly = true)
    public Page<BranchUserResponse> searchBranchUsers(String branchId, String keyword, Boolean isActive, Pageable pageable) {
        if (!SecurityUtils.hasRole("SUPER_ADMIN")) {
            branchId = SecurityUtils.getCurrentBranchId(); // Enforce branch context
        }
        return repository.findAll(BranchUserSpecification.search(branchId, keyword, isActive), pageable)
                .map(this::mapToResponse);
    }

    public BranchUserResponse updateBranchUser(String id, BranchUserUpdateRequest request) {
        java.util.UUID uuid = java.util.UUID.fromString(id);
        BranchUserEntity entity = repository.findById(uuid)
                .orElseThrow(() -> new ResourceNotFoundException("BranchUser not found with id: " + id));
        
        validateBranchAccess(entity.getBranchId());

        if (repository.existsByEmailAndIdNot(request.getEmail(), entity.getId())) {
            throw new InvalidRequestException("User with this email already exists");
        }

        if (request.getUsername() != null && repository.existsByUsernameAndIdNot(request.getUsername(), entity.getId())) {
            throw new InvalidRequestException("User with this username already exists");
        }

        boolean wasActive = Boolean.TRUE.equals(entity.getIsActive());

        entity.setFullName(request.getFullName());
        entity.setEmail(request.getEmail());
        entity.setPhone(request.getPhone());
        entity.setRole(request.getRole());
        entity.setIsActive(request.getIsActive());
        entity.setUsername(request.getUsername());

        // Update in Keycloak if enabled
        keycloakAdminServiceProvider.ifAvailable(service -> service.updateUser(entity));

        BranchUserEntity savedEntity = repository.save(entity);
        
        String details = String.format("{\"email\":\"%s\", \"username\":\"%s\", \"role\":\"%s\"}", savedEntity.getEmail(), savedEntity.getUsername(), savedEntity.getRole());
        
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
        BranchUserEntity entity = repository.findById(java.util.UUID.fromString(id))
                .orElseThrow(() -> new ResourceNotFoundException("BranchUser not found with id: " + id));
        validateBranchAccess(entity.getBranchId());
        
        keycloakAdminServiceProvider.ifAvailable(service -> service.deleteUser(entity.getKeycloakId()));

        repository.delete(entity);
        
        String details = String.format("{\"email\":\"%s\", \"username\":\"%s\"}", entity.getEmail(), entity.getUsername());
        auditService.log("DELETE_BRANCH_USER", "BRANCH_USER", entity.getId(), null, details, getCurrentIp());
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
        if (!SecurityUtils.hasRole("SUPER_ADMIN") && !entityBranchId.equals(SecurityUtils.getCurrentBranchId())) {
            throw new InvalidRequestException("You do not have access to this branch user");
        }
    }

    private BranchUserResponse mapToResponse(BranchUserEntity entity) {
        BranchUserResponse response = new BranchUserResponse();
        response.setId(entity.getId() != null ? entity.getId().toString() : null);
        response.setBranchId(entity.getBranchId());
        response.setKeycloakId(entity.getKeycloakId());
        response.setFullName(entity.getFullName());
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
}
