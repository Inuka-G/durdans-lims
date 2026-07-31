package com.uom.lims.verification;

import com.uom.lims.AbstractIntegrationTest;
import com.uom.lims.api.enums.ResultFlag;
import com.uom.lims.api.enums.SampleStatus;
import com.uom.lims.api.verification.dto.request.BulkVerificationRequest;
import com.uom.lims.api.verification.dto.request.VerificationRequest;
import com.uom.lims.api.verification.enums.ResultStatus;
import com.uom.lims.audit.AuditLog;
import com.uom.lims.audit.AuditLogRepository;
import com.uom.lims.entity.SampleEntity;
import com.uom.lims.entity.TestCatalogEntity;
import com.uom.lims.entity.TestParameterEntity;
import com.uom.lims.entity.TestResultEntity;
import com.uom.lims.patient.PatientEntity;
import com.uom.lims.repository.SampleRepository;
import com.uom.lims.repository.TestResultRepository;
import com.uom.lims.service.VerificationService;
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
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * E2 — clinical-safety path #1 (verification). Proves verify flips state + writes audit,
 * a wrong-status verify is rejected, and — the load-bearing assertion — bulkVerify's
 * per-result {@code REQUIRES_NEW} boundary commits the successes even when another result
 * in the batch fails (the bug that previously reported VERIFIED while rolling back).
 */
class VerificationFlowIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private VerificationService verificationService;
    @Autowired
    private ClinicalPathTestFixtures fixtures;
    @Autowired
    private TestResultRepository testResultRepository;
    @Autowired
    private SampleRepository sampleRepository;
    @Autowired
    private AuditLogRepository auditLogRepository;

    private TestParameterEntity param;
    private TestCatalogEntity catalog;
    private PatientEntity patient;

    @BeforeEach
    void seed() {
        fixtures.cleanAll();
        fixtures.branch("B001");
        patient = fixtures.patient("P-VER-1", "B001");
        catalog = fixtures.catalog("FBC-VER", "Full Blood Count", "58410-2");
        param = fixtures.parameter(catalog.getId(), "Haemoglobin", "718-7",
                new BigDecimal("12"), new BigDecimal("17"), new BigDecimal("7"), new BigDecimal("22"));
        authAs("LAB_SUPERVISOR", "B001");
    }

    @AfterEach
    void clearAuth() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void verifyFlipsStatusAndWritesAudit() {
        SampleEntity sample = fixtures.sampleGraph(patient, catalog, SampleStatus.SENT_FOR_VERIFICATION, "S-VER-1");
        TestResultEntity result = fixtures.result(sample, param, ResultFlag.NORMAL,
                ResultStatus.ENTERED, new BigDecimal("14.0"), "14.0", false);

        verificationService.verifyResult(result.getId(), VerificationRequest.builder().build());

        TestResultEntity reloaded = testResultRepository.findById(result.getId()).orElseThrow();
        assertThat(reloaded.getStatus()).isEqualTo(ResultStatus.TECHNICALLY_VERIFIED);
        assertThat(reloaded.getTechnicallyVerifiedBy()).isNotBlank();
        assertThat(reloaded.getTechnicallyVerifiedAt()).isNotNull();
        assertThat(sampleRepository.findById(sample.getId()).orElseThrow().getStatus())
                .isEqualTo(SampleStatus.VERIFIED);

        List<AuditLog> audit = auditLogRepository
                .findByEntityTypeAndEntityIdOrderByTimestampDesc("VERIFICATION", result.getId());
        assertThat(audit).extracting(AuditLog::getAction).contains("VERIFICATION_APPROVED");
    }

    @Test
    void verifyRejectsResultNotInEnteredStatus() {
        SampleEntity sample = fixtures.sampleGraph(patient, catalog, SampleStatus.VERIFIED, "S-VER-2");
        TestResultEntity alreadyVerified = fixtures.result(sample, param, ResultFlag.NORMAL,
                ResultStatus.TECHNICALLY_VERIFIED, new BigDecimal("14.0"), "14.0", false);

        assertThatThrownBy(() ->
                verificationService.verifyResult(alreadyVerified.getId(), VerificationRequest.builder().build()))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void bulkVerifyCommitsSuccessesIndependentlyOfFailures() {
        // A is verifiable; B is REJECTED so verifyResult(B) throws.
        SampleEntity sampleA = fixtures.sampleGraph(patient, catalog, SampleStatus.SENT_FOR_VERIFICATION, "S-VER-A");
        TestResultEntity resultA = fixtures.result(sampleA, param, ResultFlag.NORMAL,
                ResultStatus.ENTERED, new BigDecimal("14.0"), "14.0", false);
        SampleEntity sampleB = fixtures.sampleGraph(patient, catalog, SampleStatus.SENT_FOR_VERIFICATION, "S-VER-B");
        TestResultEntity resultB = fixtures.result(sampleB, param, ResultFlag.NORMAL,
                ResultStatus.REJECTED, new BigDecimal("14.0"), "14.0", false);

        Map<String, String> outcome = verificationService.bulkVerify(BulkVerificationRequest.builder()
                .resultIds(List.of(resultA.getId().toString(), resultB.getId().toString()))
                .build());

        assertThat(outcome.get(resultA.getId().toString())).isEqualTo("VERIFIED");
        assertThat(outcome.get(resultB.getId().toString())).startsWith("FAILED");

        // A's success was COMMITTED in its own REQUIRES_NEW transaction; B is untouched.
        assertThat(testResultRepository.findById(resultA.getId()).orElseThrow().getStatus())
                .isEqualTo(ResultStatus.TECHNICALLY_VERIFIED);
        assertThat(testResultRepository.findById(resultB.getId()).orElseThrow().getStatus())
                .isEqualTo(ResultStatus.REJECTED);
    }

    private void authAs(String role, String branch) {
        Jwt jwt = Jwt.withTokenValue("test-token").header("alg", "none")
                .claim("name", "Sup Test").claim("branch_code", branch).subject("user-1").build();
        SecurityContextHolder.getContext().setAuthentication(
                new JwtAuthenticationToken(jwt, List.of(new SimpleGrantedAuthority("ROLE_" + role))));
    }
}
