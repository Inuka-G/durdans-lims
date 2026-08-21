package com.uom.lims.clinical;

import com.uom.lims.AbstractIntegrationTest;
import com.uom.lims.api.clinical.dto.request.ClinicalAuthRequest;
import com.uom.lims.api.enums.ResultFlag;
import com.uom.lims.api.enums.SampleStatus;
import com.uom.lims.api.verification.enums.ResultStatus;
import com.uom.lims.entity.SampleEntity;
import com.uom.lims.entity.TestCatalogEntity;
import com.uom.lims.entity.TestParameterEntity;
import com.uom.lims.entity.TestResultEntity;
import com.uom.lims.exception.InvalidRequestException;
import com.uom.lims.patient.PatientEntity;
import com.uom.lims.repository.TestResultRepository;
import com.uom.lims.service.ClinicalAuthorizationService;
import com.uom.lims.support.ClinicalPathTestFixtures;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Pathologist module alignment: the clinical interpretation is mandatory on the
 * server, and admins get read-only oversight of the queue while authorization and
 * return stay with PATHOLOGIST.
 */
class ClinicalReviewAlignmentIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private ClinicalAuthorizationService clinicalAuthorizationService;
    @Autowired
    private ClinicalPathTestFixtures fixtures;
    @Autowired
    private TestResultRepository testResultRepository;
    @Autowired
    private MockMvc mockMvc;

    private TestResultEntity verifiedResult;

    @BeforeEach
    void seed() {
        fixtures.cleanAll();
        fixtures.branch("B001");
        PatientEntity patient = fixtures.patient("P-CLIN-1", "B001");
        TestCatalogEntity catalog = fixtures.catalog("FBC-CLIN", "Full Blood Count", "58410-2");
        TestParameterEntity param = fixtures.parameter(catalog.getId(), "Haemoglobin", "718-7",
                new BigDecimal("12"), new BigDecimal("17"), new BigDecimal("7"), new BigDecimal("22"));
        SampleEntity sample = fixtures.sampleGraph(patient, catalog, SampleStatus.VERIFIED, "S-CLIN-1");
        verifiedResult = fixtures.result(sample, param, ResultFlag.NORMAL,
                ResultStatus.TECHNICALLY_VERIFIED, new BigDecimal("14.0"), "14.0", false);
    }

    @AfterEach
    void clearAuth() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void authorizationWithoutAnInterpretationIsRejected() {
        authAs("PATHOLOGIST", "B001");

        assertThatThrownBy(() -> clinicalAuthorizationService.authorizeResult(verifiedResult.getId(),
                ClinicalAuthRequest.builder().signatureConfirmed(true).clinicalNote("   ").build()))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("interpretation");

        assertThat(testResultRepository.findById(verifiedResult.getId()).orElseThrow().getStatus())
                .isEqualTo(ResultStatus.TECHNICALLY_VERIFIED);
    }

    @Test
    void adminsCanReadTheClinicalQueueButOnlyAPathologistCanAuthorize() throws Exception {
        mockMvc.perform(get("/api/v1/clinical/pending")
                        .with(asRole("BRANCH_ADMIN", "B001")))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/clinical/history")
                        .with(asRole("SUPER_ADMIN", "B001")))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/clinical/" + verifiedResult.getId())
                        .with(asRole("BRANCH_ADMIN", "B001")))
                .andExpect(status().isOk());

        String authorizeBody = "{\"status\":\"CLINICALLY_AUTHORIZED\",\"clinicalNote\":\"Normal study\",\"signatureConfirmed\":true}";
        mockMvc.perform(post("/api/v1/clinical/" + verifiedResult.getId() + "/authorize")
                        .with(asRole("BRANCH_ADMIN", "B001"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(authorizeBody))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/clinical/" + verifiedResult.getId() + "/return")
                        .with(asRole("SUPER_ADMIN", "B001"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"returnReason\":\"Recheck\"}"))
                .andExpect(status().isForbidden());

        // A role outside the module cannot even read it.
        mockMvc.perform(get("/api/v1/clinical/pending")
                        .with(asRole("PHLEBOTOMIST", "B001")))
                .andExpect(status().isForbidden());

        assertThat(testResultRepository.findById(verifiedResult.getId()).orElseThrow().getStatus())
                .isEqualTo(ResultStatus.TECHNICALLY_VERIFIED);
    }

    private static SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor asRole(String role, String branch) {
        return SecurityMockMvcRequestPostProcessors.jwt()
                .jwt(jwt -> jwt.claim("name", "Test " + role).claim("branch_code", branch).subject("user-" + role))
                .authorities(new SimpleGrantedAuthority("ROLE_" + role));
    }

    private void authAs(String role, String branch) {
        Jwt jwt = Jwt.withTokenValue("test-token").header("alg", "none")
                .claim("name", "Dr Path").claim("branch_code", branch).subject("path-1").build();
        SecurityContextHolder.getContext().setAuthentication(
                new JwtAuthenticationToken(jwt, List.of(new SimpleGrantedAuthority("ROLE_" + role))));
    }
}
