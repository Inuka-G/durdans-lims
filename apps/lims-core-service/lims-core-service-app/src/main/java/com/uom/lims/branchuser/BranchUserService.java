package com.uom.lims.branchuser;

import com.uom.lims.api.branchuser.dto.request.BranchUserCreateRequest;
import com.uom.lims.api.branchuser.dto.request.BranchUserUpdateRequest;
import com.uom.lims.api.branchuser.dto.response.BranchUserResponse;
import com.uom.lims.exception.InvalidRequestException;
import com.uom.lims.exception.ResourceNotFoundException;
import com.uom.lims.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@Transactional
@RequiredArgsConstructor
public class BranchUserService {

    private final BranchUserRepository repository;

    public BranchUserResponse createBranchUser(BranchUserCreateRequest request) {
        // Simple context check (e.g., must be a SUPER_ADMIN or BRANCH_ADMIN for this branch)
        String userBranchCode = SecurityUtils.getCurrentBranchId();
        if (!SecurityUtils.hasRole("SUPER_ADMIN") && !request.getBranchId().equals(userBranchCode)) {
            throw new InvalidRequestException("You can only create users in your own branch");
        }

        if (repository.existsByEmail(request.getEmail())) {
            throw new InvalidRequestException("User with this email already exists");
        }

        BranchUserEntity entity = new BranchUserEntity();
        entity.setBranchId(request.getBranchId());
        entity.setFullName(request.getFullName());
        entity.setEmail(request.getEmail());
        entity.setPhone(request.getPhone());
        entity.setRole(request.getRole());
        entity.setIsActive(request.getIsActive());
        entity.setUsername(request.getUsername());

        entity = repository.save(entity);
        return mapToResponse(entity);
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

        if (repository.existsByEmailAndIdNot(request.getEmail(), uuid)) {
            throw new InvalidRequestException("User with this email already exists");
        }

        entity.setFullName(request.getFullName());
        entity.setEmail(request.getEmail());
        entity.setPhone(request.getPhone());
        entity.setRole(request.getRole());
        entity.setIsActive(request.getIsActive());
        entity.setUsername(request.getUsername());

        entity = repository.save(entity);
        return mapToResponse(entity);
    }

    public void deleteBranchUser(String id) {
        BranchUserEntity entity = repository.findById(java.util.UUID.fromString(id))
                .orElseThrow(() -> new ResourceNotFoundException("BranchUser not found with id: " + id));
        validateBranchAccess(entity.getBranchId());
        
        repository.delete(entity);
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
}
