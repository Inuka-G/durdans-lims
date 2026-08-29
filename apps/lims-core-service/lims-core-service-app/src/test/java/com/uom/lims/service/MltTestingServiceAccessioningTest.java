package com.uom.lims.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.uom.lims.api.dto.request.SampleRejectRequest;
import com.uom.lims.api.enums.Priority;
import com.uom.lims.api.enums.RejectionReason;
import com.uom.lims.api.enums.SampleStatus;
import com.uom.lims.audit.AuditLogRepository;
import com.uom.lims.audit.AuditService;
import com.uom.lims.entity.OrderEntity;
import com.uom.lims.entity.OrderItemEntity;
import com.uom.lims.entity.SampleEntity;
import com.uom.lims.exception.BusinessRuleException;
import com.uom.lims.patient.PatientRepository;
import com.uom.lims.qc.QcGateService;
import com.uom.lims.refrange.ReferenceRangeService;
import com.uom.lims.repository.SampleRepository;
import com.uom.lims.repository.TestCatalogRepository;
import com.uom.lims.repository.TestParameterRepository;
import com.uom.lims.repository.TestResultRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Reception accessioning: what a lab receptionist's accept and reject actually do.
 *
 * <p>The rejection half is the point. A rejected sample is not the end of the story - the
 * test is still ordered, so the draw has to happen again. Phlebotomy's own rejection path
 * has always created that recollection; accessioning did not, so a sample rejected at the
 * lab door went to REJECTED and stopped, with nothing reaching the collection worklist.
 */
class MltTestingServiceAccessioningTest {

    private SampleRepository sampleRepository;
    private SampleService sampleService;
    private AuditService auditService;
    private MltTestingService service;

    private SampleEntity sample;

    @BeforeEach
    void setUp() {
        sampleRepository = mock(SampleRepository.class);
        sampleService = mock(SampleService.class);
        auditService = mock(AuditService.class);
        PatientRepository patientRepository = mock(PatientRepository.class);
        TestCatalogRepository testCatalogRepository = mock(TestCatalogRepository.class);

        service = new MltTestingService(
                sampleRepository,
                mock(TestParameterRepository.class),
                mock(TestResultRepository.class),
                testCatalogRepository,
                patientRepository,
                mock(ReferenceRangeService.class),
                auditService,
                mock(AuditLogRepository.class),
                new ObjectMapper(),
                mock(com.uom.lims.notification.CriticalValueNotificationService.class),
                mock(QcGateService.class),
                sampleService,
                mock(ResultNumberService.class));

        OrderEntity order = new OrderEntity();
        order.setOrderNo("ORD-1");
        order.setPatientId("PAT-001");
        order.setBranchCode("BR001");

        OrderItemEntity item = new OrderItemEntity();
        item.setOrder(order);
        item.setTestId(UUID.randomUUID());

        sample = new SampleEntity();
        sample.setId(UUID.randomUUID());
        sample.setOrderItem(item);
        sample.setBarcode("SMP-0001");
        sample.setPriority(Priority.NORMAL);
        sample.setStatus(SampleStatus.COLLECTED);

        when(sampleRepository.findById(sample.getId())).thenReturn(Optional.of(sample));
        when(sampleRepository.save(any(SampleEntity.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        SampleEntity recollection = new SampleEntity();
        recollection.setBarcode("SMP-0002");
        recollection.setStatus(SampleStatus.RECOLLECTION_REQUIRED);
        when(sampleService.createRecollectionFor(any(SampleEntity.class))).thenReturn(recollection);

        // SUPER_ADMIN so the branch guard is satisfied without a branch claim; the
        // tenant rules themselves are covered by TenantIsolationIntegrationTest.
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(
                Jwt.withTokenValue("t").header("alg", "none").claim("preferred_username", "reception1").build(),
                List.of(new SimpleGrantedAuthority("ROLE_SUPER_ADMIN"))));
    }

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void rejectingAtAccessioningSendsTheSampleBackForRecollection() {
        service.rejectSample(sample.getId(), rejectRequest(RejectionReason.HEMOLYZED, null));

        assertThat(sample.getStatus()).isEqualTo(SampleStatus.REJECTED);
        // The whole point: the draw is queued again rather than the order stalling.
        verify(sampleService).createRecollectionFor(sample);
    }

    @Test
    void theRejectionIsStillAudited() {
        service.rejectSample(sample.getId(), rejectRequest(RejectionReason.HEMOLYZED, null));

        verify(auditService).log(
                org.mockito.ArgumentMatchers.eq("REJECTED"),
                org.mockito.ArgumentMatchers.eq("SAMPLE_ACCESSIONING"),
                org.mockito.ArgumentMatchers.eq(sample.getId()),
                org.mockito.ArgumentMatchers.eq("PAT-001"),
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.isNull());
    }

    @Test
    void aSampleThatNeverArrivedCannotBeRejected() {
        sample.setStatus(SampleStatus.PENDING_COLLECTION);

        assertThatThrownBy(() -> service.rejectSample(sample.getId(),
                rejectRequest(RejectionReason.HEMOLYZED, null)))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("Only COLLECTED samples can be rejected");

        verify(sampleService, never()).createRecollectionFor(any());
    }

    @Test
    void anInvalidRejectionQueuesNothing() {
        // OTHER without notes is refused - and must not leave a recollection behind it.
        assertThatThrownBy(() -> service.rejectSample(sample.getId(),
                rejectRequest(RejectionReason.OTHER, "  ")))
                .isInstanceOf(BusinessRuleException.class);

        verify(sampleService, never()).createRecollectionFor(any());
    }

    @Test
    void acceptingDoesNotQueueARecollection() {
        service.acceptSample(sample.getId());

        assertThat(sample.getStatus()).isEqualTo(SampleStatus.ACCEPTED);
        verify(sampleService, never()).createRecollectionFor(any());
    }

    private static SampleRejectRequest rejectRequest(RejectionReason reason, String notes) {
        SampleRejectRequest request = new SampleRejectRequest();
        request.setRejectionReason(reason);
        request.setRejectionNotes(notes);
        return request;
    }
}
