package com.uom.lims.notification;

import com.uom.lims.AbstractIntegrationTest;
import com.uom.lims.api.critical.dto.request.AcknowledgeCriticalRequest;
import com.uom.lims.api.critical.dto.response.CriticalNotificationResponse;
import com.uom.lims.api.enums.CriticalNotificationStatus;
import com.uom.lims.api.enums.ResultFlag;
import com.uom.lims.api.enums.SampleStatus;
import com.uom.lims.api.verification.enums.ResultStatus;
import com.uom.lims.audit.AuditLog;
import com.uom.lims.audit.AuditLogRepository;
import com.uom.lims.entity.SampleEntity;
import com.uom.lims.entity.TestCatalogEntity;
import com.uom.lims.entity.TestParameterEntity;
import com.uom.lims.entity.TestResultEntity;
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
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Proves the H1 critical-value callback workflow against a real database: a critical
 * result opens a callback, delivery marks it notified and records an attempt,
 * acknowledgment captures the mandatory read-back, an overdue unacknowledged callback
 * escalates, and every step writes a tamper-evident audit row. Non-critical results
 * open nothing, and opening is idempotent.
 */
class CriticalValueNotificationIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private CriticalValueNotificationService service;
    @Autowired
    private ClinicalPathTestFixtures fixtures;
    @Autowired
    private CriticalValueNotificationRepository notificationRepository;
    @Autowired
    private CriticalValueEscalationAttemptRepository attemptRepository;
    @Autowired
    private AuditLogRepository auditLogRepository;
    @Autowired
    private TestResultRepository testResultRepository;
    @Autowired
    private PlatformTransactionManager txManager;

    private static final String ENTITY_TYPE = "CRITICAL_VALUE";

    private TransactionTemplate tx;
    private TestResultEntity criticalResult;

    @BeforeEach
    void seed() {
        fixtures.cleanAll();
        tx = new TransactionTemplate(txManager);
        PatientEntity patient = fixtures.patient("P-CRIT-1", "B001");
        TestCatalogEntity catalog = fixtures.catalog("CHEM-CRIT", "Electrolytes", "2823-3");
        TestParameterEntity param = fixtures.parameter(catalog.getId(), "Potassium", "2823-3",
                new BigDecimal("3.5"), new BigDecimal("5.1"), new BigDecimal("2.5"), new BigDecimal("6.5"));
        SampleEntity sample = fixtures.sampleGraph(patient, catalog, SampleStatus.SENT_FOR_VERIFICATION, "S-CRIT-1");
        criticalResult = fixtures.result(sample, param, ResultFlag.CRITICAL_HIGH,
                ResultStatus.ENTERED, new BigDecimal("7.2"), "7.2", false);
        authAs("LAB_SUPERVISOR", "B001");
    }

    @AfterEach
    void clearAuth() {
        SecurityContextHolder.clearContext();
    }

    private void open(TestResultEntity result) {
        // Reload inside the transaction (as the real result-entry / ingestion paths do) so
        // the lazy sample→order graph is reachable when openForResult resolves the recipient.
        tx.executeWithoutResult(status ->
                service.openForResult(testResultRepository.findById(result.getId()).orElseThrow()));
    }

    private CriticalValueNotification callbackFor(UUID resultId) {
        return notificationRepository.findAll().stream()
                .filter(n -> resultId.equals(n.getResultId()))
                .findFirst().orElseThrow();
    }

    @Test
    void criticalResultOpensPendingCallbackAndAudits() {
        open(criticalResult);

        CriticalValueNotification n = callbackFor(criticalResult.getId());
        assertThat(n.getStatus()).isEqualTo(CriticalNotificationStatus.PENDING);
        assertThat(n.getFlag()).isEqualTo("CRITICAL_HIGH");
        assertThat(n.getResultValue()).isEqualTo("7.2");
        assertThat(n.getPatientCode()).isEqualTo("P-CRIT-1");
        assertThat(n.getParameterName()).isEqualTo("Potassium");
        assertThat(n.getNextEscalationDueAt()).isNotNull();

        List<AuditLog> audit = auditLogRepository
                .findByEntityTypeAndEntityIdOrderByTimestampDesc(ENTITY_TYPE, criticalResult.getId());
        assertThat(audit).extracting(AuditLog::getAction).contains("CRITICAL_RAISED");
    }

    @Test
    void openIsIdempotentPerResult() {
        open(criticalResult);
        open(criticalResult);

        long count = notificationRepository.findAll().stream()
                .filter(n -> criticalResult.getId().equals(n.getResultId()))
                .count();
        assertThat(count).isEqualTo(1);
    }

    @Test
    void normalResultOpensNoCallback() {
        PatientEntity patient = fixtures.patient("P-NORM-1", "B001");
        TestCatalogEntity catalog = fixtures.catalog("CHEM-NORM", "Electrolytes", "2823-3");
        TestParameterEntity param = fixtures.parameter(catalog.getId(), "Potassium", "2823-3",
                new BigDecimal("3.5"), new BigDecimal("5.1"), new BigDecimal("2.5"), new BigDecimal("6.5"));
        SampleEntity sample = fixtures.sampleGraph(patient, catalog, SampleStatus.SENT_FOR_VERIFICATION, "S-NORM-1");
        TestResultEntity normal = fixtures.result(sample, param, ResultFlag.NORMAL,
                ResultStatus.ENTERED, new BigDecimal("4.2"), "4.2", false);

        open(normal);

        assertThat(notificationRepository.findAll())
                .noneMatch(n -> normal.getId().equals(n.getResultId()));
    }

    @Test
    void deliveryMarksNotifiedAndRecordsAttempt() {
        open(criticalResult);
        CriticalValueNotification n = callbackFor(criticalResult.getId());

        service.deliverInitial(n);

        CriticalValueNotification reloaded = notificationRepository.findById(n.getId()).orElseThrow();
        assertThat(reloaded.getStatus()).isEqualTo(CriticalNotificationStatus.NOTIFIED);
        assertThat(reloaded.getNotifiedAt()).isNotNull();
        assertThat(attemptRepository.findByNotificationIdOrderByLevelAsc(n.getId()))
                .anyMatch(a -> "SENT".equals(a.getStatus()));
    }

    @Test
    void acknowledgeCapturesReadBack() {
        open(criticalResult);
        CriticalValueNotification n = callbackFor(criticalResult.getId());

        CriticalNotificationResponse response = service.acknowledge(n.getId(),
                AcknowledgeCriticalRequest.builder()
                        .readBackText("Potassium 7.2 CRITICAL HIGH")
                        .communicatedTo("Dr Perera, Ward 5")
                        .readBackVerified(true)
                        .build());

        assertThat(response.getStatus()).isEqualTo("ACKNOWLEDGED");

        CriticalValueNotification reloaded = notificationRepository.findById(n.getId()).orElseThrow();
        assertThat(reloaded.getStatus()).isEqualTo(CriticalNotificationStatus.ACKNOWLEDGED);
        assertThat(reloaded.getReadBackText()).isEqualTo("Potassium 7.2 CRITICAL HIGH");
        assertThat(reloaded.getCommunicatedTo()).isEqualTo("Dr Perera, Ward 5");
        assertThat(reloaded.getAcknowledgedBy()).isNotBlank();
        assertThat(reloaded.getNextEscalationDueAt()).isNull();

        List<AuditLog> audit = auditLogRepository
                .findByEntityTypeAndEntityIdOrderByTimestampDesc(ENTITY_TYPE, criticalResult.getId());
        assertThat(audit).extracting(AuditLog::getAction).contains("CRITICAL_ACKNOWLEDGED");
    }

    @Test
    void acknowledgeRequiresReadBack() {
        open(criticalResult);
        CriticalValueNotification n = callbackFor(criticalResult.getId());

        assertThatThrownBy(() -> service.acknowledge(n.getId(),
                AcknowledgeCriticalRequest.builder().communicatedTo("someone").build()))
                .isInstanceOf(InvalidRequestException.class);
    }

    @Test
    void overdueUnacknowledgedCallbackEscalates() {
        open(criticalResult);
        CriticalValueNotification n = callbackFor(criticalResult.getId());
        // Force it to be a delivered, overdue callback.
        n.setStatus(CriticalNotificationStatus.NOTIFIED);
        n.setNotifiedAt(Instant.now());
        n.setNextEscalationDueAt(Instant.now().minusSeconds(120));
        notificationRepository.save(n);

        assertThat(service.dueForEscalation(Instant.now(), 50))
                .extracting(CriticalValueNotification::getId)
                .contains(n.getId());

        service.escalate(n);

        CriticalValueNotification reloaded = notificationRepository.findById(n.getId()).orElseThrow();
        assertThat(reloaded.getStatus()).isEqualTo(CriticalNotificationStatus.ESCALATED);
        assertThat(reloaded.getEscalationLevel()).isEqualTo(1);

        List<AuditLog> audit = auditLogRepository
                .findByEntityTypeAndEntityIdOrderByTimestampDesc(ENTITY_TYPE, criticalResult.getId());
        assertThat(audit).extracting(AuditLog::getAction).contains("CRITICAL_ESCALATED");
    }

    private void authAs(String role, String branch) {
        Jwt jwt = Jwt.withTokenValue("test-token")
                .header("alg", "none")
                .claim("name", "Sup Test")
                .claim("branch_code", branch)
                .subject("user-1")
                .build();
        SecurityContextHolder.getContext().setAuthentication(
                new JwtAuthenticationToken(jwt, List.of(new SimpleGrantedAuthority("ROLE_" + role))));
    }
}
