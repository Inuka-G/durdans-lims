package com.uom.lims.service;

import com.uom.lims.AbstractIntegrationTest;
import com.uom.lims.api.enums.ResultFlag;
import com.uom.lims.api.enums.SampleStatus;
import com.uom.lims.api.verification.dto.request.ResultAmendmentRequest;
import com.uom.lims.api.verification.dto.response.ResultAmendmentResponse;
import com.uom.lims.api.verification.enums.ResultStatus;
import com.uom.lims.audit.AuditLog;
import com.uom.lims.audit.AuditLogRepository;
import com.uom.lims.entity.SampleEntity;
import com.uom.lims.entity.TestCatalogEntity;
import com.uom.lims.entity.TestParameterEntity;
import com.uom.lims.entity.TestResultEntity;
import com.uom.lims.exception.BusinessRuleException;
import com.uom.lims.exception.InvalidRequestException;
import com.uom.lims.patient.PatientEntity;
import com.uom.lims.repository.TestResultRepository;
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
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Proves H2 result amendment/versioning against a real database: a released result is
 * never overwritten — a correction preserves the original as a new immutable version,
 * recomputes the flag, marks the live row amended, and writes a RESULT_AMENDED audit
 * row; and unreleased / unsigned amendments are rejected.
 */
class ResultAmendmentIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private ResultAmendmentService amendmentService;
    @Autowired
    private ClinicalPathTestFixtures fixtures;
    @Autowired
    private TestResultRepository testResultRepository;
    @Autowired
    private AuditLogRepository auditLogRepository;

    private static final String AMEND_ENTITY_TYPE = "TEST_RESULT_AMENDMENT";

    private TestResultEntity authorizedResult;

    @BeforeEach
    void seed() {
        fixtures.cleanAll();
        PatientEntity patient = fixtures.patient("P-AMD-1", "B001");
        TestCatalogEntity catalog = fixtures.catalog("FBC-AMD", "Full Blood Count", "58410-2");
        TestParameterEntity param = fixtures.parameter(catalog.getId(), "Haemoglobin", "718-7",
                new BigDecimal("4"), new BigDecimal("10"), new BigDecimal("2"), new BigDecimal("20"));
        SampleEntity sample = fixtures.sampleGraph(patient, catalog, SampleStatus.AUTHORIZED, "S-AMD-1");
        authorizedResult = fixtures.result(sample, param, ResultFlag.NORMAL,
                ResultStatus.CLINICALLY_AUTHORIZED, new BigDecimal("5.0"), "5.0", false);
        authAs("PATHOLOGIST", "B001");
    }

    @AfterEach
    void clearAuth() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void amendingReleasedResultPreservesOriginalAsNewVersion() {
        ResultAmendmentRequest request = ResultAmendmentRequest.builder()
                .newValue("12.0")
                .amendmentReason("Re-run after analyzer recalibration")
                .signatureConfirmed(true)
                .build();

        ResultAmendmentResponse response = amendmentService.amendResult(authorizedResult.getId(), request);

        assertThat(response.getVersionNo()).isEqualTo(2);
        assertThat(response.getPreviousValue()).isEqualTo("5.0");
        assertThat(response.getNewValue()).isEqualTo("12.0");
        assertThat(response.getPreviousStatus()).isEqualTo("CLINICALLY_AUTHORIZED");
        // 12 is above ref-high (10) but below critical-high (20) → recomputed HIGH.
        assertThat(response.getNewFlag()).isEqualTo("HIGH");

        TestResultEntity reloaded = testResultRepository.findById(authorizedResult.getId()).orElseThrow();
        assertThat(reloaded.getResultValue()).isEqualTo("12.0");
        assertThat(reloaded.getResultNumeric()).isEqualByComparingTo("12.0");
        assertThat(reloaded.getVersionNo()).isEqualTo(2);
        assertThat(reloaded.getAmended()).isTrue();
        assertThat(reloaded.getStatus()).isEqualTo(ResultStatus.CLINICALLY_AUTHORIZED);

        List<ResultAmendmentResponse> history = amendmentService.getAmendmentHistory(authorizedResult.getId());
        assertThat(history).hasSize(1);

        List<AuditLog> auditRows = auditLogRepository
                .findByEntityTypeAndEntityIdOrderByTimestampDesc(AMEND_ENTITY_TYPE, authorizedResult.getId());
        assertThat(auditRows).extracting(AuditLog::getAction).contains("RESULT_AMENDED");
    }

    @Test
    void amendmentWithoutSignatureIsRejected() {
        ResultAmendmentRequest request = ResultAmendmentRequest.builder()
                .newValue("12.0")
                .amendmentReason("typo")
                .signatureConfirmed(false)
                .build();

        assertThatThrownBy(() -> amendmentService.amendResult(authorizedResult.getId(), request))
                .isInstanceOf(InvalidRequestException.class);

        assertThat(testResultRepository.findById(authorizedResult.getId()).orElseThrow().getVersionNo())
                .isEqualTo(1);
    }

    @Test
    void amendingUnreleasedResultIsRejected() {
        PatientEntity patient = fixtures.patient("P-AMD-2", "B001");
        TestCatalogEntity catalog = fixtures.catalog("FBC-AMD2", "Full Blood Count", "58410-2");
        TestParameterEntity param = fixtures.parameter(catalog.getId(), "Haemoglobin", "718-7",
                new BigDecimal("4"), new BigDecimal("10"), new BigDecimal("2"), new BigDecimal("20"));
        SampleEntity sample = fixtures.sampleGraph(patient, catalog, SampleStatus.SENT_FOR_VERIFICATION, "S-AMD-2");
        TestResultEntity enteredResult = fixtures.result(sample, param, ResultFlag.NORMAL,
                ResultStatus.ENTERED, new BigDecimal("5.0"), "5.0", false);

        ResultAmendmentRequest request = ResultAmendmentRequest.builder()
                .newValue("6.0")
                .amendmentReason("should be edited via entry, not amended")
                .signatureConfirmed(true)
                .build();

        UUID id = enteredResult.getId();
        assertThatThrownBy(() -> amendmentService.amendResult(id, request))
                .isInstanceOf(BusinessRuleException.class);
    }

    private void authAs(String role, String branch) {
        Jwt jwt = Jwt.withTokenValue("test-token")
                .header("alg", "none")
                .claim("name", "Dr Test")
                .claim("branch_code", branch)
                .subject("user-1")
                .build();
        SecurityContextHolder.getContext().setAuthentication(
                new JwtAuthenticationToken(jwt, List.of(new SimpleGrantedAuthority("ROLE_" + role))));
    }
}
