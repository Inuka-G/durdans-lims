package com.uom.lims.notification;

import com.uom.lims.entity.BillEntity;
import com.uom.lims.entity.OrderEntity;
import com.uom.lims.patient.PatientEntity;
import com.uom.lims.patient.PatientRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;

/** Patient-facing order tracking notifications. */
@Service
@RequiredArgsConstructor
public class PatientLifecycleNotificationService {

    private final PatientRepository patientRepository;
    private final ApplicationEventPublisher eventPublisher;

    public void orderCreated(OrderEntity order, BillEntity bill) {
        publishToVerifiedPhone(order.getPatientId(),
                "Durdans LIMS | Order received: " + order.getOrderNo()
                        + " | Bill: " + bill.getBillNo()
                        + " | Total: LKR " + money(bill.getTotalAmount())
                        + " | Status: Awaiting payment. Keep the order number for tracking.");
    }

    public void paymentConfirmed(BillEntity bill, String paymentMethod) {
        OrderEntity order = bill.getOrder();
        if (order == null) return;
        publishToVerifiedPhone(order.getPatientId(),
                "Durdans LIMS | Payment confirmed"
                        + " | Order: " + order.getOrderNo()
                        + " | Bill: " + bill.getBillNo()
                        + " | Amount: LKR " + money(bill.getPaidAmount())
                        + " | Method: " + readable(paymentMethod)
                        + " | Status: Paid. Sample collection can proceed. Thank you.");
    }

    private void publishToVerifiedPhone(String patientCode, String message) {
        if (patientCode == null || patientCode.isBlank()) return;
        patientRepository.findByPatientCode(patientCode.trim())
                .filter(PatientEntity::isPhoneVerified)
                .map(PatientEntity::getPhone)
                .filter(phone -> phone != null && !phone.isBlank())
                .ifPresent(phone -> eventPublisher.publishEvent(
                        new PatientLifecycleSmsRequestedEvent(phone.trim(), message)));
    }

    private static String money(BigDecimal value) {
        return value == null ? "0.00" : value.setScale(2, RoundingMode.HALF_UP).toPlainString();
    }

    private static String readable(String value) {
        return value == null || value.isBlank() ? "Not recorded" : value.replace('_', ' ');
    }
}
