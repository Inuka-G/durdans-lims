package com.uom.lims.clinical;

import com.uom.lims.AbstractIntegrationTest;
import com.uom.lims.api.clinical.dto.request.ClinicalAuthRequest;
import com.uom.lims.api.enums.ResultFlag;
import com.uom.lims.api.enums.SampleStatus;
import com.uom.lims.api.verification.enums.ResultStatus;
import com.uom.lims.audit.AuditLog;
import com.uom.lims.audit.AuditLogRepository;
import com.uom.lims.dispatch.ReportDispatchItemRepository;
import com.uom.lims.entity.SampleEntity;
import com.uom.lims.entity.TestCatalogEntity;
import com.uom.lims.entity.TestParameterEntity;
import com.uom.lims.entity.TestResultEntity;
import com.uom.lims.exception.InvalidRequestException;
import com.uom.lims.patient.PatientEntity;
import com.uom.lims.repository.SampleRepository;
import com.uom.lims.repository.TestResultRepository;
import com.uom.lims.service.ClinicalAuthorizationService;
import com.uom.lims.support.ClinicalPathTestFixtures;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * E2 — clinical-safety path #2 (authorization). Proves a signed authorization releases
 * the result (status + e-signature), flips the sample to AUTHORIZED, writes a
 * CLINICAL_AUTHORIZED audit row, and registers the report for dispatch; and that an
 * unsigned authorization is rejected with no state change and no dispatch row.
 */
class ClinicalAuthorizationIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private ClinicalAuthorizationService clinicalAuthorizationService;
    @Autowired
    private ClinicalPathTestFixtures fixtures;
    @Autowired
    private TestResultRepository testResultRepository;
    @Autowired
    private SampleRepository sampleRepository;
    @Autowired
    private AuditLogRepository auditLogRepository;
    @Autowired
    private ReportDispatchItemRepository dispatchItemRepository;

    private TestResultEntity verifiedResult;
    private SampleEntity sample;

    @BeforeEach
    void seed() {
        fixtures.cleanAll();
        fixtures.branch("B001");
        PatientEntity patient = fixtures.patient("P-AUTH-1", "B001");
        TestCatalogEntity catalog = fixtures.catalog("FBC-AUTH", "Full Blood Count", "58410-2");
        TestParameterEntity param = fixtures.parameter(catalog.getId(), "Haemoglobin", "718-7",
                new BigDecimal("12"), new BigDecimal("17"), new BigDecimal("7"), new BigDecimal("22"));
        sample = fixtures.sampleGraph(patient, catalog, SampleStatus.VERIFIED, "S-AUTH-1");
        verifiedResult = fixtures.result(sample, param, ResultFlag.NORMAL,
                ResultStatus.TECHNICALLY_VERIFIED, new BigDecimal("14.0"), "14.0", false);
        authAs("PATHOLOGIST", "B001");
    }

    @AfterEach
    void clearAuth() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void signedAuthorizationReleasesResultAndRegistersDispatch() {
        clinicalAuthorizationService.authorizeResult(verifiedResult.getId(),
                ClinicalAuthRequest.builder().signatureConfirmed(true).clinicalNote("Reviewed, normal").build());

        TestResultEntity reloaded = testResultRepository.findById(verifiedResult.getId()).orElseThrow();
        assertThat(reloaded.getStatus()).isEqualTo(ResultStatus.CLINICALLY_AUTHORIZED);
        assertThat(reloaded.getClinicalSignature()).isNotBlank();
        assertThat(reloaded.getClinicallyAuthorizedBy()).isNotBlank();
        assertThat(reloaded.getClinicallyAuthorizedAt()).isNotNull();

        assertThat(sampleRepository.findById(sample.getId()).orElseThrow().getStatus())
                .isEqualTo(SampleStatus.AUTHORIZED);

        List<AuditLog> audit = auditLogRepository
                .findByEntityTypeAndEntityIdOrderByTimestampDesc("VERIFICATION", verifiedResult.getId());
        assertThat(audit).extracting(AuditLog::getAction).contains("CLINICAL_AUTHORIZED");

        assertThat(dispatchItemRepository
                .findByReportReferenceAndBranchCode(verifiedResult.getId().toString(), "B001"))
                .isPresent();
    }

    @Test
    void unsignedAuthorizationIsRejectedWithNoStateChange() {
        assertThatThrownBy(() -> clinicalAuthorizationService.authorizeResult(verifiedResult.getId(),
                ClinicalAuthRequest.builder().signatureConfirmed(false).clinicalNote("x").build()))
                .isInstanceOf(InvalidRequestException.class);

        assertThat(testResultRepository.findById(verifiedResult.getId()).orElseThrow().getStatus())
                .isEqualTo(ResultStatus.TECHNICALLY_VERIFIED);
        assertThat(sampleRepository.findById(sample.getId()).orElseThrow().getStatus())
                .isEqualTo(SampleStatus.VERIFIED);
        assertThat(dispatchItemRepository
                .findByReportReferenceAndBranchCode(verifiedResult.getId().toString(), "B001"))
                .isEmpty();
    }

    private void authAs(String role, String branch) {
        Jwt jwt = Jwt.withTokenValue("test-token").header("alg", "none")
                .claim("name", "Dr Path").claim("branch_code", branch).subject("path-1").build();
        SecurityContextHolder.getContext().setAuthentication(
                new JwtAuthenticationToken(jwt, List.of(new SimpleGrantedAuthority("ROLE_" + role))));
    }
}
