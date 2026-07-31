package com.uom.lims.metadata;

import com.uom.lims.api.metadata.MetadataResponse;
import com.uom.lims.entity.BranchEntity;
import com.uom.lims.entity.HeaderMappingEntity;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;

import com.uom.lims.security.SecurityUtils;
import lombok.extern.slf4j.Slf4j;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class MetadataService {

    private final BranchRepository branchRepository;
    private final HeaderMappingRepository headerMappingRepository;

    public MetadataResponse getMetadata() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof Jwt jwt)) {
            log.warn("Unauthenticated request to metadata endpoint - returning defaults");
            return getDefaultMetadata();
        }

        // 1. Get Branch Info using SecurityUtils (includes fallback logic)
        String branchCode = SecurityUtils.getCurrentBranchId();
        log.info("Extracted branchCode for metadata: {}", branchCode);

        String branchName = "No Branch Assigned";
        if (branchCode != null) {
            branchName = branchRepository.findByCode(branchCode)
                    .map(BranchEntity::getName)
                    .orElse(branchCode + " Branch");
        }

        // 2. Get Nav Items based on Roles
        List<String> roles = extractRoles(jwt);
        log.info("Extracted roles for metadata: {}", roles);

        List<HeaderMappingEntity> mappings = headerMappingRepository.findAllByRoleNameInOrderByPriorityAsc(roles);
        log.info("Found {} mappings for roles {}", mappings.size(), roles);

        // Deduplicate and map to DTO
        List<MetadataResponse.NavItem> navItems = mappings.stream()
                .map(m -> new MetadataResponse.NavItem(m.getDisplayText(), m.getLinkUrl()))
                .distinct()
                .collect(Collectors.toList());

        return MetadataResponse.builder()
                .currentBranchName(branchName)
                .currentBranchCode(branchCode)
                .navItems(navItems)
                .build();
    }

    @SuppressWarnings("unchecked")
    private List<String> extractRoles(Jwt jwt) {
        Map<String, Object> realmAccess = jwt.getClaim("realm_access");
        if (realmAccess == null || realmAccess.get("roles") == null) {
            log.warn("No 'realm_access.roles' found in JWT");
            return List.of();
        }
        List<String> roles = (List<String>) realmAccess.get("roles");
        return roles.stream()
                .map(String::toUpperCase)
                .collect(Collectors.toList());
    }

    private MetadataResponse getDefaultMetadata() {
        return MetadataResponse.builder()
                .currentBranchName("Main Branch")
                .navItems(List.of(
                        new MetadataResponse.NavItem("Patient Management", "/dashboard")))
                .build();
    }
}
