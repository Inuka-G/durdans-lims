package com.uom.lims.branch;

import com.uom.lims.admin.AdminUserService;
import com.uom.lims.entity.BranchEntity;
import com.uom.lims.exception.BusinessRuleException;
import com.uom.lims.exception.ResourceNotFoundException;
import com.uom.lims.metadata.BranchRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Set;

/**
 * The real branch directory behind the Super Admin "Branch management" screen.
 *
 * <p>The {@code branch} table already existed (see {@link BranchRepository})
 * and was already seeded with every real branch this hospital network has —
 * it just had no columns for the details/admin the screen wants, and no API.
 * This adds both, on the existing table, instead of standing up a second,
 * disconnected source of truth.
 *
 * <p>{@link AdminUserService} is optional: it only exists as a bean when
 * {@code app.keycloak-admin.enabled=true}. When it's there, assigning a
 * branch admin here also re-parents that Keycloak user (branch attribute +
 * BRANCH_ADMIN role) so the assignment is real on both sides, not just a
 * label on the branch row; when it's not, the assignment still records who
 * the admin is, it just can't push that back into Keycloak.
 */
@Service
@RequiredArgsConstructor
public class BranchService {

    private static final Set<String> VALID_STATUSES = Set.of("ACTIVE", "INACTIVE");

    private final BranchRepository branchRepository;
    private final ObjectProvider<AdminUserService> adminUserService;

    public List<BranchResponse> listBranches() {
        return branchRepository.findAll().stream()
                .filter(b -> !b.isDeleted())
                .sorted(Comparator.comparing(BranchEntity::getCode))
                .map(BranchService::toResponse)
                .toList();
    }

    public BranchResponse getBranch(String code) {
        return toResponse(findByCode(code));
    }

    @Transactional
    public BranchResponse createBranch(CreateBranchRequest request) {
        String code = normalizeCode(request.code());
        if (code == null || code.isBlank()) {
            throw new BusinessRuleException("Branch code is required");
        }
        if (request.name() == null || request.name().isBlank()) {
            throw new BusinessRuleException("Branch name is required");
        }
        branchRepository.findByCode(code).ifPresent(existing -> {
            throw new BusinessRuleException("A branch with code " + code + " already exists");
        });

        BranchEntity entity = new BranchEntity();
        entity.setCode(code);
        entity.setName(request.name());
        entity.setLocation(blankToNull(request.location()));
        entity.setAddress(blankToNull(request.address()));
        entity.setContactEmail(blankToNull(request.contactEmail()));
        entity.setContactPhone(blankToNull(request.contactPhone()));
        entity.setStatus(normalizeStatus(request.status()));
        entity.setLegalEntityName(blankToNull(request.legalEntityName()));
        entity.setEstablishedDate(request.establishedDate());

        return toResponse(branchRepository.save(entity));
    }

    @Transactional
    public BranchResponse updateBranch(String code, UpdateBranchRequest request) {
        BranchEntity entity = findByCode(code);
        if (request.name() != null && !request.name().isBlank()) {
            entity.setName(request.name());
        }
        if (request.location() != null) {
            entity.setLocation(blankToNull(request.location()));
        }
        if (request.address() != null) {
            entity.setAddress(blankToNull(request.address()));
        }
        if (request.contactEmail() != null) {
            entity.setContactEmail(blankToNull(request.contactEmail()));
        }
        if (request.contactPhone() != null) {
            entity.setContactPhone(blankToNull(request.contactPhone()));
        }
        if (request.status() != null) {
            entity.setStatus(normalizeStatus(request.status()));
        }
        if (request.legalEntityName() != null) {
            entity.setLegalEntityName(blankToNull(request.legalEntityName()));
        }
        if (request.establishedDate() != null) {
            entity.setEstablishedDate(request.establishedDate());
        }
        return toResponse(branchRepository.save(entity));
    }

    @Transactional
    public BranchResponse assignAdmin(String code, AssignBranchAdminRequest request) {
        if (request.userId() == null || request.userId().isBlank()) {
            throw new BusinessRuleException("A user is required to assign as branch admin");
        }
        BranchEntity entity = findByCode(code);
        entity.setAdminUserId(request.userId());
        entity.setAdminName(request.name());
        entity.setAdminEmail(request.email());
        entity = branchRepository.save(entity);

        // Make it real on the Keycloak side too, when that integration is on:
        // re-parent the chosen user to this branch and grant BRANCH_ADMIN,
        // exactly what editing them from Global User Control would do.
        AdminUserService keycloakUsers = adminUserService.getIfAvailable();
        if (keycloakUsers != null) {
            keycloakUsers.updateUser(request.userId(),
                    new AdminUserService.UpdateUserRequest(null, null, null, "BRANCH_ADMIN", code));
        }

        return toResponse(entity);
    }

    private BranchEntity findByCode(String code) {
        return branchRepository.findByCodeIgnoreCase(normalizeCode(code))
                .filter(b -> !b.isDeleted())
                .orElseThrow(() -> new ResourceNotFoundException("Branch not found: " + code));
    }

    private static String normalizeCode(String code) {
        return code == null ? null : code.trim().toUpperCase();
    }

    private static String normalizeStatus(String status) {
        if (status == null || status.isBlank()) {
            return "ACTIVE";
        }
        String upper = status.trim().toUpperCase();
        if (!VALID_STATUSES.contains(upper)) {
            throw new BusinessRuleException("Status must be ACTIVE or INACTIVE");
        }
        return upper;
    }

    private static String blankToNull(String value) {
        return (value == null || value.isBlank()) ? null : value.trim();
    }

    private static BranchResponse toResponse(BranchEntity b) {
        return new BranchResponse(
                b.getId(),
                b.getCode(), b.getName(), b.getLocation(), b.getAddress(),
                b.getContactEmail(), b.getContactPhone(), b.getStatus(),
                b.getEstablishedDate(), b.getLegalEntityName(),
                b.getAdminUserId(), b.getAdminName(), b.getAdminEmail());
    }

    /** Create-branch request. {@code code} is the short business code (e.g. "BR001", "COL-7"). */
    public record CreateBranchRequest(String code, String name, String location, String address,
                                      String contactEmail, String contactPhone, String status,
                                      String legalEntityName, LocalDate establishedDate) {
    }

    /** Edit-branch request. Every field is optional; only non-null ones are applied. */
    public record UpdateBranchRequest(String name, String location, String address,
                                      String contactEmail, String contactPhone, String status,
                                      String legalEntityName, LocalDate establishedDate) {
    }

    /** Assign (or re-assign) this branch's admin. */
    public record AssignBranchAdminRequest(String userId, String name, String email) {
    }

    /** Branch view. */
    public record BranchResponse(java.util.UUID id, String code, String name, String location, String address,
                                 String contactEmail, String contactPhone, String status,
                                 LocalDate establishedDate, String legalEntityName,
                                 String adminUserId, String adminName, String adminEmail) {
    }
}
