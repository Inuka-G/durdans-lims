package com.uom.lims.qc;

import com.uom.lims.AbstractIntegrationTest;
import com.uom.lims.api.enums.ResultFlag;
import com.uom.lims.api.enums.SampleStatus;
import com.uom.lims.api.verification.dto.request.VerificationRequest;
import com.uom.lims.api.verification.enums.ResultStatus;
import com.uom.lims.audit.AuditLog;
import com.uom.lims.audit.AuditLogRepository;
import com.uom.lims.entity.SampleEntity;
import com.uom.lims.entity.TestCatalogEntity;
import com.uom.lims.entity.TestParameterEntity;
import com.uom.lims.entity.TestResultEntity;
import com.uom.lims.exception.BusinessRuleException;
import com.uom.lims.patient.PatientEntity;
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
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The QC release gate, against a real database.
 *
 * <p>Westgard rules were evaluated and the verdict discarded: a failed control did
 * not hold, block or flag patient results from the same run. These tests pin the
 * invariant that replaced that — no result is technically verified unless the QC
 * governing its analyser and analyte passed, or a supervisor released it over the
 * failure with a recorded reason.
 */
class QcReleaseGateIntegrationTest extends AbstractIntegrationTest {

    private static final String INSTRUMENT = "inst-001";
    private static final String LOINC = "777-3";
    private static final String OVERRIDE_REASON =
            "Control re-run in control; original vial compromised on the bench.";

    @Autowired
    private VerificationService verificationService;
    @Autowired
    private ClinicalPathTestFixtures fixtures;
    @Autowired
    private TestResultRepository testResultRepository;
    @Autowired
    private AuditLogRepository auditLogRepository;

    private TestParameterEntity parameter;
    private TestCatalogEntity catalog;

    @BeforeEach
    void seed() {
        fixtures.cleanAll();
        fixtures.branch("B001");
        catalog = fixtures.catalog("FBC-QC", "Full Blood Count", "58410-2");
        parameter = fixtures.parameter(catalog.getId(), "Platelets", LOINC,
                new BigDecimal("150"), new BigDecimal("400"), new BigDecimal("20"), new BigDecimal("1000"));
    }

    @AfterEach
    void clearAuth() {
        SecurityContextHolder.clearContext();
    }

    /** A result measured on the registered analyser an hour ago, awaiting verification. */
    private TestResultEntity enteredResult(String patientCode, String barcode) {
        PatientEntity patient = fixtures.patient(patientCode, "B001");
        SampleEntity sample = fixtures.sampleGraph(patient, catalog, SampleStatus.SENT_FOR_VERIFICATION, barcode);
        TestResultEntity result = fixtures.result(sample, parameter, ResultFlag.NORMAL,
                ResultStatus.ENTERED, new BigDecimal("250"), "250", false);
        result.setInstrumentCode(INSTRUMENT);
        result.setMeasuredAt(Instant.now().minus(1, ChronoUnit.HOURS));
        return testResultRepository.save(result);
    }

    private static VerificationRequest request(String qcOverrideReason) {
        return VerificationRequest.builder()
                .mltNotes("checked")
                .qcOverrideReason(qcOverrideReason)
                .build();
    }

    @Test
    void passingQcAllowsVerification() {
        fixtures.qcResult(INSTRUMENT, LOINC, "L1", "PASS", Instant.now().minus(2, ChronoUnit.HOURS));
        TestResultEntity result = enteredResult("P-QC-PASS", "S-QC-PASS");
        authAs("LAB_SUPERVISOR");

        verificationService.verifyResult(result.getId(), request(null));

        TestResultEntity reloaded = testResultRepository.findById(result.getId()).orElseThrow();
        assertThat(reloaded.getStatus()).isEqualTo(ResultStatus.TECHNICALLY_VERIFIED);
        assertThat(reloaded.getQcStatus()).isEqualTo("PASS");
        assertThat(reloaded.getQcOverrideBy()).isNull();
    }

    @Test
    void failedQcBlocksVerification() {
        fixtures.qcResult(INSTRUMENT, LOINC, "L1", "FAIL", Instant.now().minus(2, ChronoUnit.HOURS));
        TestResultEntity result = enteredResult("P-QC-FAIL", "S-QC-FAIL");
        authAs("LAB_SUPERVISOR");

        assertThatThrownBy(() -> verificationService.verifyResult(result.getId(), request(null)))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("QC hold");

        assertThat(testResultRepository.findById(result.getId()).orElseThrow().getStatus())
                .isEqualTo(ResultStatus.ENTERED);
    }

    /**
     * Fail-safe. A result produced on an analyser with no control on file is not
     * "probably fine" — nobody has established that the instrument was working.
     */
    @Test
    void absentQcBlocksVerification() {
        TestResultEntity result = enteredResult("P-QC-NONE", "S-QC-NONE");
        authAs("LAB_SUPERVISOR");

        assertThatThrownBy(() -> verificationService.verifyResult(result.getId(), request(null)))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("QC hold");
    }

    /** A control older than the configured window governs nothing. */
    @Test
    void staleQcBlocksVerification() {
        fixtures.qcResult(INSTRUMENT, LOINC, "L1", "PASS", Instant.now().minus(40, ChronoUnit.HOURS));
        TestResultEntity result = enteredResult("P-QC-STALE", "S-QC-STALE");
        authAs("LAB_SUPERVISOR");

        assertThatThrownBy(() -> verificationService.verifyResult(result.getId(), request(null)))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("QC hold");
    }

    /** 1-2s is a warning rule by construction; holding on it would produce constant false holds. */
    @Test
    void warningQcDoesNotBlockVerification() {
        fixtures.qcResult(INSTRUMENT, LOINC, "L1", "WARN", Instant.now().minus(2, ChronoUnit.HOURS));
        TestResultEntity result = enteredResult("P-QC-WARN", "S-QC-WARN");
        authAs("LAB_SUPERVISOR");

        verificationService.verifyResult(result.getId(), request(null));

        TestResultEntity reloaded = testResultRepository.findById(result.getId()).orElseThrow();
        assertThat(reloaded.getStatus()).isEqualTo(ResultStatus.TECHNICALLY_VERIFIED);
        assertThat(reloaded.getQcStatus()).isEqualTo("WARN");
    }

    /** A run is in control only if EVERY level was — the worst level decides. */
    @Test
    void oneFailingControlLevelBlocksEvenWhenAnotherPassed() {
        Instant when = Instant.now().minus(2, ChronoUnit.HOURS);
        fixtures.qcResult(INSTRUMENT, LOINC, "L1", "PASS", when);
        fixtures.qcResult(INSTRUMENT, LOINC, "L2", "FAIL", when);
        TestResultEntity result = enteredResult("P-QC-MIX", "S-QC-MIX");
        authAs("LAB_SUPERVISOR");

        assertThatThrownBy(() -> verificationService.verifyResult(result.getId(), request(null)))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("QC hold");
    }

    /** An MLT must not be able to waive the control they ran. */
    @Test
    void mltCannotOverrideAFailedControl() {
        fixtures.qcResult(INSTRUMENT, LOINC, "L1", "FAIL", Instant.now().minus(2, ChronoUnit.HOURS));
        TestResultEntity result = enteredResult("P-QC-MLT", "S-QC-MLT");
        authAs("MLT");

        assertThatThrownBy(() -> verificationService.verifyResult(result.getId(), request(OVERRIDE_REASON)))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("lab supervisor");
    }

    @Test
    void supervisorOverrideRequiresADocumentedReason() {
        fixtures.qcResult(INSTRUMENT, LOINC, "L1", "FAIL", Instant.now().minus(2, ChronoUnit.HOURS));
        TestResultEntity result = enteredResult("P-QC-NOREASON", "S-QC-NOREASON");
        authAs("LAB_SUPERVISOR");

        assertThatThrownBy(() -> verificationService.verifyResult(result.getId(), request("ok")))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("documented reason");
    }

    /**
     * The override releases the result and is recorded — but it does NOT rewrite the
     * QC status to PASS. Laundering a failed control into a passing one is the exact
     * outcome the gate exists to prevent.
     */
    @Test
    void supervisorMayReleaseOverAFailedControlAndItStaysRecordedAsFailed() {
        fixtures.qcResult(INSTRUMENT, LOINC, "L1", "FAIL", Instant.now().minus(2, ChronoUnit.HOURS));
        TestResultEntity result = enteredResult("P-QC-OVR", "S-QC-OVR");
        authAs("LAB_SUPERVISOR");

        verificationService.verifyResult(result.getId(), request(OVERRIDE_REASON));

        TestResultEntity reloaded = testResultRepository.findById(result.getId()).orElseThrow();
        assertThat(reloaded.getStatus()).isEqualTo(ResultStatus.TECHNICALLY_VERIFIED);
        assertThat(reloaded.getQcStatus()).as("a waived failure is still a failure").isEqualTo("FAIL");
        assertThat(reloaded.getQcOverrideBy()).isNotNull();
        assertThat(reloaded.getQcOverrideAt()).isNotNull();
        assertThat(reloaded.getQcOverrideReason()).isEqualTo(OVERRIDE_REASON);

        List<AuditLog> audit = auditLogRepository
                .findByEntityTypeAndEntityIdOrderByTimestampDesc("VERIFICATION", result.getId());
        assertThat(audit).extracting(AuditLog::getAction).contains("QC_OVERRIDE_RELEASE");
    }

    private void authAs(String role) {
        Jwt jwt = Jwt.withTokenValue("test-token")
                .header("alg", "none")
                .claim("name", "Test User")
                .claim("branch_code", "B001")
                .subject("user-qc")
                .build();
        SecurityContextHolder.getContext().setAuthentication(
                new JwtAuthenticationToken(jwt, List.of(new SimpleGrantedAuthority("ROLE_" + role))));
    }
}
