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
import java.util.Locale;

/**
 * Patient-facing order tracking notifications.
 *
 * <p>Laid out over several lines rather than run together with pipes: these are read on a
 * phone, and a label per line is what makes an order number scannable at a glance. The
 * gateway carries the line breaks because the message is posted as a form body - see
 * {@link OzoneDeskSmsService#sendSms}.
 */
@Service
@RequiredArgsConstructor
public class PatientLifecycleNotificationService {

    private final PatientRepository patientRepository;
    private final ApplicationEventPublisher eventPublisher;

    public void orderCreated(OrderEntity order, BillEntity bill) {
        publishToVerifiedPhone(order.getPatientId(),
                "Durdans LIMS\n"
                        + "Order received\n"
                        + "\n"
                        + "Order: " + order.getOrderNo() + "\n"
                        + "Bill: " + bill.getBillNo() + "\n"
                        + "Total: LKR " + money(bill.getTotalAmount()) + "\n"
                        + "\n"
                        + "Status: Awaiting payment\n"
                        + "\n"
                        + "Keep your order number for tracking.");
    }

    public void paymentConfirmed(BillEntity bill, String paymentMethod) {
        OrderEntity order = bill.getOrder();
        if (order == null) return;
        publishToVerifiedPhone(order.getPatientId(),
                "Durdans LIMS\n"
                        + "Payment confirmed\n"
                        + "\n"
                        + "Order: " + order.getOrderNo() + "\n"
                        + "Bill: " + bill.getBillNo() + "\n"
                        + "Amount: LKR " + money(bill.getPaidAmount()) + "\n"
                        + "Method: " + readable(paymentMethod) + "\n"
                        + "\n"
                        + "Status: Paid\n"
                        + "Sample collection can proceed.\n"
                        + "\n"
                        + "Thank you.");
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

    /** Grouped to thousands: "12,450.00" is read correctly on a phone, "12450.00" is not. */
    private static String money(BigDecimal value) {
        BigDecimal amount = value == null ? BigDecimal.ZERO : value;
        return String.format(Locale.US, "%,.2f", amount.setScale(2, RoundingMode.HALF_UP));
    }

    private static String readable(String value) {
        return value == null || value.isBlank() ? "Not recorded" : value.replace('_', ' ');
    }
}
