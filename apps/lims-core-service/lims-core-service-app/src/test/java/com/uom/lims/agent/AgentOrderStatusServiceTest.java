package com.uom.lims.agent;

import com.uom.lims.api.dto.response.AgentOrderStatusResponse;
import com.uom.lims.api.enums.OrderStatus;
import com.uom.lims.api.enums.SampleStatus;
import com.uom.lims.entity.OrderEntity;
import com.uom.lims.entity.OrderItemEntity;
import com.uom.lims.patient.PatientEntity;
import com.uom.lims.patient.PatientRepository;
import com.uom.lims.repository.OrderRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AgentOrderStatusServiceTest {

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private PatientRepository patientRepository;

    @InjectMocks
    private AgentOrderStatusService service;

    private static OrderEntity order(String orderNo, OrderStatus status, SampleStatus... itemStatuses) {
        OrderEntity order = new OrderEntity();
        order.setOrderNo(orderNo);
        order.setPatientId("P-0001");
        order.setStatus(status);
        for (SampleStatus itemStatus : itemStatuses) {
            OrderItemEntity item = new OrderItemEntity();
            item.setStatus(itemStatus);
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
    }

    @Test
    void reportReadyWhenEveryItemClearedAuthorization() {
        known(order("LAB-100", OrderStatus.IN_PROGRESS,
                SampleStatus.AUTHORIZED, SampleStatus.DISPATCHED), "0771234567");

        AgentOrderStatusResponse response = service.status("LAB-100", "94771234567");

        assertThat(response.found()).isTrue();
        assertThat(response.reportReady()).isTrue();
        assertThat(response.stage()).isEqualTo(AgentOrderStatusResponse.STAGE_REPORT_READY);
        assertThat(response.testsCompleted()).isEqualTo(2);
    }

    @Test
    void processingWhileAnyItemIsStillInFlight() {
        known(order("LAB-101", OrderStatus.IN_PROGRESS,
                SampleStatus.AUTHORIZED, SampleStatus.IN_TESTING), "0771234567");

        AgentOrderStatusResponse response = service.status("LAB-101", "+94 77 123 4567");

        assertThat(response.reportReady()).isFalse();
        assertThat(response.stage()).isEqualTo(AgentOrderStatusResponse.STAGE_PROCESSING);
        assertThat(response.testsCompleted()).isEqualTo(1);
        assertThat(response.totalTests()).isEqualTo(2);
    }

    @Test
    void wrongPhoneIsIndistinguishableFromNoSuchOrder() {
        known(order("LAB-102", OrderStatus.IN_PROGRESS, SampleStatus.AUTHORIZED), "0779999999");

        AgentOrderStatusResponse mismatch = service.status("LAB-102", "94771234567");
        AgentOrderStatusResponse unknown = service.status("LAB-404", "94771234567");

        assertThat(mismatch).isEqualTo(AgentOrderStatusResponse.notFound());
        assertThat(mismatch).isEqualTo(unknown);
    }

    @Test
    void cancelledOrdersSaySoInsteadOfNeverBecomingReady() {
        known(order("LAB-103", OrderStatus.CANCELLED, SampleStatus.PENDING_COLLECTION), "0771234567");

        assertThat(service.status("LAB-103", "0771234567").stage())
                .isEqualTo(AgentOrderStatusResponse.STAGE_CANCELLED);
    }

    @Test
    void untouchedOrdersReadAsReceived() {
        known(order("LAB-104", OrderStatus.PENDING,
                SampleStatus.PENDING_COLLECTION, SampleStatus.PENDING_COLLECTION), "0771234567");

        assertThat(service.status("LAB-104", "0771234567").stage())
                .isEqualTo(AgentOrderStatusResponse.STAGE_RECEIVED);
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
