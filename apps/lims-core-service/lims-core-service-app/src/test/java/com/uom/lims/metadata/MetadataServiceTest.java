package com.uom.lims.metadata;

import com.uom.lims.api.metadata.MetadataResponse;
import com.uom.lims.entity.HeaderMappingEntity;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MetadataServiceTest {

    @Mock
    private BranchRepository branchRepository;

    @Mock
    private HeaderMappingRepository headerMappingRepository;

    @InjectMocks
    private MetadataService metadataService;

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void deduplicatesNavigationGrantedByMultipleRolesUsingLinkUrl() {
        Jwt jwt = Jwt.withTokenValue("test-token")
                .header("alg", "none")
                .claim("branch_id", "COL")
                .claim("realm_access", Map.of(
                        "roles", List.of("mlt", "lab_supervisor", "pathologist")))
                .build();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt));

        when(branchRepository.findByCode("COL")).thenReturn(Optional.empty());
        when(headerMappingRepository.findAllByRoleNameInOrderByPriorityAsc(anyList()))
                .thenReturn(List.of(
                        mapping("MLT", "Critical Values", "/critical-values", 15),
                        mapping("LAB_SUPERVISOR", "Critical Values", "/critical-values", 15),
                        mapping("PATHOLOGIST", "Critical Values", "/critical-values", 15),
                        mapping("MLT", "Report Dispatch", "/report-dispatch", 80)));

        MetadataResponse response = metadataService.getMetadata();

        assertThat(response.getNavItems())
                .extracting(MetadataResponse.NavItem::getLinkUrl)
                .containsExactly("/critical-values", "/report-dispatch");
    }

    private HeaderMappingEntity mapping(String role, String label, String url, int priority) {
        return new HeaderMappingEntity(role, label, url, priority);
    }
}
