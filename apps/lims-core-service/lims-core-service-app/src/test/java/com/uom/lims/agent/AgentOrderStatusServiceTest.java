package com.uom.lims.agent;

import com.uom.lims.api.dto.response.AgentOrderStatusResponse;
import com.uom.lims.api.enums.OrderStatus;
import com.uom.lims.api.enums.SampleStatus;
import com.uom.lims.entity.OrderEntity;
import com.uom.lims.entity.OrderItemEntity;
import com.uom.lims.entity.SampleEntity;
import com.uom.lims.entity.TestCatalogEntity;
import com.uom.lims.patient.PatientEntity;
import com.uom.lims.patient.PatientRepository;
import com.uom.lims.repository.OrderRepository;
import com.uom.lims.repository.TestCatalogRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AgentOrderStatusServiceTest {

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private PatientRepository patientRepository;

    @Mock
    private TestCatalogRepository testCatalogRepository;

    @InjectMocks
    private AgentOrderStatusService service;

    private static OrderItemEntity item(SampleStatus... sampleStatuses) {
        OrderItemEntity item = new OrderItemEntity();
        item.setTestId(UUID.randomUUID());
        long tick = 0;
        for (SampleStatus status : sampleStatuses) {
            SampleEntity sample = new SampleEntity();
            sample.setStatus(status);
            // Ordered creation times so "newest sample wins" is deterministic.
            sample.setCreatedAt(Instant.parse("2026-08-20T00:00:00Z").plusSeconds(tick++));
            item.getSamples().add(sample);
        }
        return item;
    }

    private static OrderEntity order(String orderNo, OrderStatus status, OrderItemEntity... items) {
        OrderEntity order = new OrderEntity();
        order.setOrderNo(orderNo);
        order.setPatientId("P-0001");
        order.setStatus(status);
        for (OrderItemEntity item : items) {
            order.getItems().add(item);
        }
        return order;
    }

    private static PatientEntity patientWithPhone(String phone) {
        PatientEntity patient = new PatientEntity();
        ReflectionTestUtils.setField(patient, "phone", phone);
        return patient;
    }

    private void known(OrderEntity order, String patientPhone) {
        when(orderRepository.findByOrderNoAndDeletedFalse(order.getOrderNo())).thenReturn(Optional.of(order));
        when(patientRepository.findByPatientCode("P-0001")).thenReturn(Optional.of(patientWithPhone(patientPhone)));
        lenient().when(testCatalogRepository.findAllById(any())).thenReturn(List.of());
    }

    @Test
    void reportReadyWhenEveryItemsNewestSampleClearedAuthorization() {
        known(order("LAB-100", OrderStatus.IN_PROGRESS,
                item(SampleStatus.AUTHORIZED), item(SampleStatus.DISPATCHED)), "0771234567");

        AgentOrderStatusResponse response = service.status("LAB-100", "94771234567");

        assertThat(response.found()).isTrue();
        assertThat(response.reportReady()).isTrue();
        assertThat(response.stage()).isEqualTo(AgentOrderStatusResponse.STAGE_REPORT_READY);
        assertThat(response.testsCompleted()).isEqualTo(2);
    }

    @Test
    void progressComesFromSamplesNotTheStaleItemStatus() {
        // The workflow never advances OrderItemEntity.status past PENDING_COLLECTION;
        // reading it would call a half-verified order "just received".
        OrderItemEntity inVerification = item(SampleStatus.SENT_FOR_VERIFICATION);
        inVerification.setStatus(SampleStatus.PENDING_COLLECTION);
        known(order("LAB-101", OrderStatus.IN_PROGRESS, inVerification, item(SampleStatus.AUTHORIZED)),
                "0771234567");

        AgentOrderStatusResponse response = service.status("LAB-101", "+94 77 123 4567");

        assertThat(response.stage()).isEqualTo(AgentOrderStatusResponse.STAGE_PROCESSING);
        assertThat(response.testsCompleted()).isEqualTo(1);
        assertThat(response.items())
                .extracting(AgentOrderStatusResponse.AgentOrderItemProgress::stage)
                .containsExactly("VERIFYING", "READY");
    }

    @Test
    void aRecollectedItemFollowsItsNewestSample() {
        // First sample rejected, fresh one already in testing: the patient hears
        // "testing", not the stale rejection.
        known(order("LAB-102", OrderStatus.IN_PROGRESS,
                item(SampleStatus.REJECTED, SampleStatus.IN_TESTING)), "0771234567");

        assertThat(service.status("LAB-102", "0771234567").items())
                .extracting(AgentOrderStatusResponse.AgentOrderItemProgress::stage)
                .containsExactly("TESTING");
    }

    @Test
    void aRejectedSampleAwaitingRecollectionAsksThePatientToAct() {
        known(order("LAB-103", OrderStatus.IN_PROGRESS, item(SampleStatus.REJECTED)), "0771234567");

        AgentOrderStatusResponse response = service.status("LAB-103", "0771234567");

        assertThat(response.items())
                .extracting(AgentOrderStatusResponse.AgentOrderItemProgress::stage)
                .containsExactly("RECOLLECTION_NEEDED");
        assertThat(response.stage()).isEqualTo(AgentOrderStatusResponse.STAGE_PROCESSING);
    }

    @Test
    void testNamesComeFromTheCatalogue() {
        OrderItemEntity item = item(SampleStatus.IN_TESTING);
        TestCatalogEntity test = new TestCatalogEntity();
        test.setId(item.getTestId());
        test.setTestName("Full Blood Count");
        known(order("LAB-104", OrderStatus.IN_PROGRESS, item), "0771234567");
        when(testCatalogRepository.findAllById(any())).thenReturn(List.of(test));

        assertThat(service.status("LAB-104", "0771234567").items())
                .extracting(AgentOrderStatusResponse.AgentOrderItemProgress::testName)
                .containsExactly("Full Blood Count");
    }

    @Test
    void wrongPhoneIsIndistinguishableFromNoSuchOrder() {
        known(order("LAB-105", OrderStatus.IN_PROGRESS, item(SampleStatus.AUTHORIZED)), "0779999999");

        AgentOrderStatusResponse mismatch = service.status("LAB-105", "94771234567");
        AgentOrderStatusResponse unknown = service.status("LAB-404", "94771234567");

        assertThat(mismatch).isEqualTo(AgentOrderStatusResponse.notFound());
        assertThat(mismatch).isEqualTo(unknown);
    }

    @Test
    void cancelledOrdersSaySoInsteadOfNeverBecomingReady() {
        known(order("LAB-106", OrderStatus.CANCELLED, item()), "0771234567");

        assertThat(service.status("LAB-106", "0771234567").stage())
                .isEqualTo(AgentOrderStatusResponse.STAGE_CANCELLED);
    }

    @Test
    void untouchedOrdersReadAsReceived() {
        known(order("LAB-107", OrderStatus.PENDING, item(), item()), "0771234567");

        AgentOrderStatusResponse response = service.status("LAB-107", "0771234567");

        assertThat(response.stage()).isEqualTo(AgentOrderStatusResponse.STAGE_RECEIVED);
        assertThat(response.items())
                .extracting(AgentOrderStatusResponse.AgentOrderItemProgress::stage)
                .containsExactly("AWAITING_COLLECTION", "AWAITING_COLLECTION");
    }

    @Test
    void phoneShapesForTheSameNumberAllMatch() {
        assertThat(AgentOrderStatusService.phoneMatches("0771234567", "94771234567")).isTrue();
        assertThat(AgentOrderStatusService.phoneMatches("+94771234567", "0771234567")).isTrue();
        assertThat(AgentOrderStatusService.phoneMatches("0771234567", "0771234568")).isFalse();
        assertThat(AgentOrderStatusService.phoneMatches(null, "0771234567")).isFalse();
        assertThat(AgentOrderStatusService.phoneMatches("123", "123")).isFalse();
    }
}
