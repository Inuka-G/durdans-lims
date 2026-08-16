package com.uom.lims.notification;

import com.uom.lims.entity.BillEntity;
import com.uom.lims.entity.OrderEntity;
import com.uom.lims.patient.PatientEntity;
import com.uom.lims.patient.PatientRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.context.ApplicationEventPublisher;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PatientLifecycleNotificationServiceTest {

    private PatientRepository patientRepository;
    private ApplicationEventPublisher publisher;
    private PatientLifecycleNotificationService service;
    private PatientEntity patient;
    private OrderEntity order;
    private BillEntity bill;

    @BeforeEach
    void setUp() {
        patientRepository = mock(PatientRepository.class);
        publisher = mock(ApplicationEventPublisher.class);
        service = new PatientLifecycleNotificationService(patientRepository, publisher);

        patient = new PatientEntity();
        patient.setPatientCode("PAT-001");
        patient.setPhone("+94702011540");
        patient.setPhoneVerified(true);
        when(patientRepository.findByPatientCode("PAT-001")).thenReturn(Optional.of(patient));

        order = new OrderEntity();
        order.setPatientId("PAT-001");
        order.setOrderNo("ORD-20260816-001");
        bill = new BillEntity();
        bill.setOrder(order);
        bill.setBillNo("INV-20260816-001");
        bill.setTotalAmount(new BigDecimal("3255"));
        bill.setPaidAmount(new BigDecimal("3255"));
    }

    @Test
    void publishesOrderTrackingSmsForVerifiedPhone() {
        service.orderCreated(order, bill);

        PatientLifecycleSmsRequestedEvent event = captureEvent();
        assertThat(event.phone()).isEqualTo("+94702011540");
        assertThat(event.message())
                .contains("Order received: ORD-20260816-001")
                .contains("Bill: INV-20260816-001")
                .contains("Total: LKR 3255.00")
                .contains("Awaiting payment");
    }

    @Test
    void publishesPaymentConfirmationSms() {
        service.paymentConfirmed(bill, "CREDIT_CARD");

        PatientLifecycleSmsRequestedEvent event = captureEvent();
        assertThat(event.message())
                .contains("Payment confirmed")
                .contains("Amount: LKR 3255.00")
                .contains("Method: CREDIT CARD")
                .contains("Sample collection can proceed");
    }

    @Test
    void doesNotSendPrivateTrackingDataToUnverifiedPhone() {
        patient.setPhoneVerified(false);

        service.orderCreated(order, bill);

        verify(publisher, never()).publishEvent(org.mockito.ArgumentMatchers.any());
    }

    private PatientLifecycleSmsRequestedEvent captureEvent() {
        ArgumentCaptor<PatientLifecycleSmsRequestedEvent> captor =
                ArgumentCaptor.forClass(PatientLifecycleSmsRequestedEvent.class);
        verify(publisher).publishEvent(captor.capture());
        return captor.getValue();
    }
}
