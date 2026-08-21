package com.uom.lims.verification;

import com.uom.lims.AbstractIntegrationTest;
import com.uom.lims.api.enums.ResultFlag;
import com.uom.lims.api.enums.SampleStatus;
import com.uom.lims.api.verification.dto.request.VerificationRequest;
import com.uom.lims.api.verification.dto.response.BulkVerificationBatchResponse;
import com.uom.lims.api.verification.dto.response.TestResultDetailResponse;
import com.uom.lims.api.verification.dto.response.TestResultParameterResponse;
import com.uom.lims.api.verification.dto.response.VerificationHistoryItemResponse;
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
import com.uom.lims.service.ResultNumberService;
import com.uom.lims.service.VerificationService;
import com.uom.lims.support.ClinicalPathTestFixtures;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Supervisor / pathologist module alignment: the case number, the return-to-MLT
 * contract (reason stamped, MLT notes kept, distinct status), the delta column
 * against the patient's prior released value, the per-case bulk worklist, and
 * the all-fields history search.
 */
class SupervisorReviewAlignmentIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private VerificationService verificationService;
    @Autowired
    private ResultNumberService resultNumberService;
    @Autowired
    private ClinicalPathTestFixtures fixtures;
    @Autowired
    private TestResultRepository testResultRepository;
    @Autowired
    private SampleRepository sampleRepository;
    @Autowired
    private AuditLogRepository auditLogRepository;
    @Autowired
    private TransactionTemplate transactionTemplate;

    private TestParameterEntity param;
    private TestCatalogEntity catalog;
    private PatientEntity patient;

    @BeforeEach
    void seed() {
        fixtures.cleanAll();
        fixtures.branch("B001");
        patient = fixtures.patient("P-ALIGN-1", "B001");
        catalog = fixtures.catalog("FBC-ALIGN", "Full Blood Count", "58410-2");
        param = fixtures.parameter(catalog.getId(), "Haemoglobin", "718-7",
                new BigDecimal("12"), new BigDecimal("17"), new BigDecimal("7"), new BigDecimal("22"));
        authAs("LAB_SUPERVISOR", "B001");
    }

    @AfterEach
    void clearAuth() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void caseNumberIsIssuedOnceInThePatientCodeShape() {
        SampleEntity sample = fixtures.sampleGraph(patient, catalog, SampleStatus.SENT_FOR_VERIFICATION, "S-NO-1");

        String first = transactionTemplate.execute(status -> {
            SampleEntity managed = sampleRepository.findById(sample.getId()).orElseThrow();
            String issued = resultNumberService.ensureResultNo(managed);
            sampleRepository.save(managed);
            return issued;
        });
        String second = transactionTemplate.execute(status ->
                resultNumberService.ensureResultNo(sampleRepository.findById(sample.getId()).orElseThrow()));

        assertThat(first).matches("RES\\d{4}-\\d{5,}");
        assertThat(second).isEqualTo(first);
        assertThat(sampleRepository.findById(sample.getId()).orElseThrow().getResultNo()).isEqualTo(first);
    }

    @Test
    void returnToMltStampsTheReasonKeepsTheMltNoteAndUsesItsOwnStatus() {
        SampleEntity sample = fixtures.sampleGraph(patient, catalog, SampleStatus.SENT_FOR_VERIFICATION, "S-RET-1");
        TestResultEntity result = fixtures.result(sample, param, ResultFlag.NORMAL,
                ResultStatus.ENTERED, new BigDecimal("14.0"), "14.0", false);
        transactionTemplate.executeWithoutResult(status -> {
            TestResultEntity managed = testResultRepository.findById(result.getId()).orElseThrow();
            managed.setMltNotes("Bench note: run repeated once");
            testResultRepository.save(managed);
        });

        verificationService.rejectResult(result.getId(), VerificationRequest.builder()
                .mltNotes("Bench note: run repeated once")
                .supervisorNote("Haemolysed specimen - please recollect")
                .build());

        TestResultEntity reloaded = testResultRepository.findById(result.getId()).orElseThrow();
        assertThat(reloaded.getStatus()).isEqualTo(ResultStatus.RETURNED_TO_MLT);
        assertThat(reloaded.getReturnReason()).isEqualTo("Haemolysed specimen - please recollect");
        assertThat(reloaded.getReturnedBy()).isNotBlank();
        assertThat(reloaded.getReturnedAt()).isNotNull();
        // The MLT's own account of the run survives the return.
        assertThat(reloaded.getMltNotes()).contains("Bench note: run repeated once");
        assertThat(reloaded.getMltNotes()).contains("Haemolysed specimen");
        assertThat(sampleRepository.findById(sample.getId()).orElseThrow().getStatus())
                .isEqualTo(SampleStatus.IN_TESTING);

        List<AuditLog> audit = auditLogRepository
                .findByEntityTypeAndEntityIdOrderByTimestampDesc("VERIFICATION", result.getId());
        assertThat(audit).extracting(AuditLog::getAction).contains("VERIFICATION_RETURNED_TO_MLT");
        assertThat(audit.get(0).getDetails()).contains("Haemolysed specimen");

        // The detail the supervisor reopens carries the same return, and the case
        // cannot be verified while it is with the MLT.
        TestResultDetailResponse detail = verificationService.getResultDetails(result.getId());
        assertThat(detail.getReturnReason()).isEqualTo("Haemolysed specimen - please recollect");
        assertThat(detail.getReturnedBy()).isNotBlank();
        assertThatThrownBy(() ->
                verificationService.verifyResult(result.getId(), VerificationRequest.builder().build()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("returned to the MLT");
    }

    @Test
    void returnToMltRequiresAReason() {
        SampleEntity sample = fixtures.sampleGraph(patient, catalog, SampleStatus.SENT_FOR_VERIFICATION, "S-RET-2");
        TestResultEntity result = fixtures.result(sample, param, ResultFlag.NORMAL,
                ResultStatus.ENTERED, new BigDecimal("14.0"), "14.0", false);

        assertThatThrownBy(() -> verificationService.rejectResult(result.getId(), VerificationRequest.builder().build()))
                .hasMessageContaining("return reason");
        assertThat(testResultRepository.findById(result.getId()).orElseThrow().getStatus())
                .isEqualTo(ResultStatus.ENTERED);
    }

    @Test
    void detailCarriesDeltaAgainstThePriorReleasedValueAndSpecimenContext() {
        Instant now = Instant.now();
        SampleEntity earlier = fixtures.sampleGraph(patient, catalog, SampleStatus.AUTHORIZED, "S-DELTA-OLD");
        stampCollected(earlier, now.minus(10, ChronoUnit.DAYS));
        fixtures.result(earlier, param, ResultFlag.NORMAL,
                ResultStatus.CLINICALLY_AUTHORIZED, new BigDecimal("10.0"), "10.0", false);

        SampleEntity current = fixtures.sampleGraph(patient, catalog, SampleStatus.SENT_FOR_VERIFICATION, "S-DELTA-NEW");
        stampCollected(current, now.minus(1, ChronoUnit.HOURS));
        TestResultEntity result = fixtures.result(current, param, ResultFlag.NORMAL,
                ResultStatus.ENTERED, new BigDecimal("15.0"), "15.0", false);

        TestResultDetailResponse detail = verificationService.getResultDetails(result.getId());

        assertThat(detail.getParameters()).hasSize(1);
        TestResultParameterResponse parameter = detail.getParameters().get(0);
        assertThat(parameter.getPreviousValue()).isEqualTo("10.0");
        assertThat(parameter.getPreviousSampleBarcode()).isEqualTo("S-DELTA-OLD");
        assertThat(parameter.getDeltaAbsolute()).isEqualByComparingTo("5.0");
        assertThat(parameter.getDeltaPercent()).isEqualByComparingTo("50.0");
        assertThat(parameter.getDeltaSignificant()).isTrue();
        assertThat(detail.getPreviousVisits()).hasSize(1);
        assertThat(detail.getSampleBarcode()).isEqualTo("S-DELTA-NEW");
        assertThat(detail.getTubeType()).isEqualTo("EDTA_PURPLE");
        assertThat(detail.getCollectedAt()).isNotNull();
    }

    @Test
    void bulkWorklistDescribesEachCaseAndSplitsSafeFromHeld() {
        SampleEntity safe = fixtures.sampleGraph(patient, catalog, SampleStatus.SENT_FOR_VERIFICATION, "S-BULK-SAFE");
        TestResultEntity safeResult = fixtures.result(safe, param, ResultFlag.NORMAL,
                ResultStatus.ENTERED, new BigDecimal("14.0"), "14.0", false);
        SampleEntity held = fixtures.sampleGraph(patient, catalog, SampleStatus.SENT_FOR_VERIFICATION, "S-BULK-HELD");
        TestResultEntity heldResult = fixtures.result(held, param, ResultFlag.CRITICAL_HIGH,
                ResultStatus.ENTERED, new BigDecimal("23.0"), "23.0", false);

        List<BulkVerificationBatchResponse> worklist = verificationService.getBulkWorklist();

        assertThat(worklist).hasSize(1);
        BulkVerificationBatchResponse batch = worklist.get(0);
        assertThat(batch.getSafeForApproval()).isEqualTo(1);
        assertThat(batch.getExceptions()).isEqualTo(1);
        assertThat(batch.getResultIds()).containsExactly(safeResult.getId().toString());
        assertThat(batch.getReviewResultIds()).containsExactly(heldResult.getId().toString());
        assertThat(batch.getCases()).hasSize(2);
        assertThat(batch.getCases())
                .filteredOn(c -> c.getResultId().equals(safeResult.getId().toString()))
                .singleElement()
                .satisfies(c -> {
                    assertThat(c.isSafeForApproval()).isTrue();
                    assertThat(c.getPatientCode()).isEqualTo("P-ALIGN-1");
                    assertThat(c.getPatientName()).isEqualTo("Test Patient P-ALIGN-1");
                    assertThat(c.getSampleBarcode()).isEqualTo("S-BULK-SAFE");
                    assertThat(c.getPriorityLevel()).isEqualTo("NORMAL");
                    assertThat(c.getParameters()).hasSize(1);
                    assertThat(c.getParameters().get(0).getParameterName()).isEqualTo("Haemoglobin");
                });
        assertThat(batch.getCases())
                .filteredOn(c -> c.getResultId().equals(heldResult.getId().toString()))
                .singleElement()
                .satisfies(c -> {
                    assertThat(c.isSafeForApproval()).isFalse();
                    assertThat(c.getHasCriticalFinding()).isTrue();
                    assertThat(c.getFlag()).isEqualTo("CRITICAL_HIGH");
                });
    }

    @Test
    void historySearchFindsByPatientCaseNumberAndLegacyDisplayId() {
        SampleEntity sample = fixtures.sampleGraph(patient, catalog, SampleStatus.SENT_FOR_VERIFICATION, "S-HIST-1");
        String resultNo = transactionTemplate.execute(status -> {
            SampleEntity managed = sampleRepository.findById(sample.getId()).orElseThrow();
            String issued = resultNumberService.ensureResultNo(managed);
            sampleRepository.save(managed);
            return issued;
        });
        TestResultEntity result = fixtures.result(sample, param, ResultFlag.NORMAL,
                ResultStatus.ENTERED, new BigDecimal("14.0"), "14.0", false);

        verificationService.verifyResult(result.getId(), VerificationRequest.builder()
                .supervisorNote("Run and controls reviewed").build());

        String legacyDisplayId = "RES-" + result.getId().toString().replace("-", "")
                .substring(24).toUpperCase();

        for (String term : List.of("Test Patient P-ALIGN-1", "P-ALIGN-1", resultNo, legacyDisplayId,
                "controls reviewed", "Approved by Supervisor")) {
            Page<VerificationHistoryItemResponse> page =
                    verificationService.getVerificationHistory(0, 10, null, term, null);
            assertThat(page.getContent())
                    .as("history search for '%s'", term)
                    .anySatisfy(item -> {
                        assertThat(item.getResultId()).isEqualTo(result.getId().toString());
                        assertThat(item.getResultNo()).isEqualTo(resultNo);
                        assertThat(item.getPatientCode()).isEqualTo("P-ALIGN-1");
                        assertThat(item.getPatientName()).isEqualTo("Test Patient P-ALIGN-1");
                    });
        }

        Page<VerificationHistoryItemResponse> miss =
                verificationService.getVerificationHistory(0, 10, null, "no-such-patient-zzz", null);
        assertThat(miss.getTotalElements()).isZero();
    }

    private void stampCollected(SampleEntity sample, Instant collectedAt) {
        transactionTemplate.executeWithoutResult(status -> {
            SampleEntity managed = sampleRepository.findById(sample.getId()).orElseThrow();
            managed.setCollectedAt(collectedAt);
            managed.setCollectedBy("test-seed");
            sampleRepository.save(managed);
        });
    }

    private void authAs(String role, String branch) {
        Jwt jwt = Jwt.withTokenValue("test-token").header("alg", "none")
                .claim("name", "Sup Test").claim("branch_code", branch).subject("user-1").build();
        SecurityContextHolder.getContext().setAuthentication(
                new JwtAuthenticationToken(jwt, List.of(new SimpleGrantedAuthority("ROLE_" + role))));
    }
}
