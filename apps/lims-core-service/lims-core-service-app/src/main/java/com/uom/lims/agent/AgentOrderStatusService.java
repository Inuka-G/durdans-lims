package com.uom.lims.agent;

import com.uom.lims.api.dto.response.AgentOrderStatusResponse;
import com.uom.lims.api.enums.OrderStatus;
import com.uom.lims.api.enums.SampleStatus;
import com.uom.lims.entity.OrderEntity;
import com.uom.lims.entity.OrderItemEntity;
import com.uom.lims.patient.PatientEntity;
import com.uom.lims.patient.PatientRepository;
import com.uom.lims.repository.OrderRepository;
import com.uom.lims.util.PiiMasker;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.ZoneId;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;

/**
 * WHY: answers "is my report ready" over WhatsApp without an OTP ceremony, by using the
 * one factor the channel proves by existing: possession of the phone. The caller passes
 * the WhatsApp sender's number, taken server-side from the conversation — never from
 * model output — and it must match the phone on the order's patient record.
 *
 * <p>The verification is deliberately conservative in what it reveals: a wrong order
 * number and a right order number on someone else's phone produce byte-identical
 * responses. Identity binding with OTP (and with it, report links) is a later phase;
 * this endpoint only ever says how far an order has progressed.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AgentOrderStatusService {

    private static final ZoneId LAB_ZONE = ZoneId.of("Asia/Colombo");

    /** An item counts as completed once its result has cleared clinical authorization. */
    private static final Set<SampleStatus> COMPLETED_ITEM_STATUSES =
            EnumSet.of(SampleStatus.AUTHORIZED, SampleStatus.DISPATCHED);

    private final OrderRepository orderRepository;
    private final PatientRepository patientRepository;

    @Transactional(readOnly = true)
    public AgentOrderStatusResponse status(String orderNo, String requesterPhone) {
        if (orderNo == null || orderNo.isBlank() || requesterPhone == null || requesterPhone.isBlank()) {
            return AgentOrderStatusResponse.notFound();
        }

        OrderEntity order = orderRepository.findByOrderNoAndDeletedFalse(orderNo.trim()).orElse(null);
        if (order == null) {
            log.info("Agent order-status lookup: no such order (requester {})", PiiMasker.maskPhone(requesterPhone));
            return AgentOrderStatusResponse.notFound();
        }

        PatientEntity patient = patientRepository.findByPatientCode(order.getPatientId()).orElse(null);
        if (patient == null || !phoneMatches(patient.getPhone(), requesterPhone)) {
            // The audit trail for a failed possession check. Same response as "no such
            // order" so the failure mode is unobservable from the outside.
            log.warn("Agent order-status lookup: possession check failed for order {} (requester {})",
                    order.getOrderNo(), PiiMasker.maskPhone(requesterPhone));
            return AgentOrderStatusResponse.notFound();
        }

        List<OrderItemEntity> items = order.getItems();
        int total = items.size();
        int completed = (int) items.stream()
                .filter(item -> COMPLETED_ITEM_STATUSES.contains(item.getStatus()))
                .count();

        String stage = stageOf(order, items, total, completed);
        boolean ready = AgentOrderStatusResponse.STAGE_REPORT_READY.equals(stage);

        log.info("Agent order-status lookup: order {} -> {} ({}/{}) for {}",
                order.getOrderNo(), stage, completed, total, PiiMasker.maskPhone(requesterPhone));

        return new AgentOrderStatusResponse(
                true,
                order.getOrderNo(),
                stage,
                ready,
                total,
                completed,
                order.getCreatedAt() == null ? null : order.getCreatedAt().atZone(LAB_ZONE).toLocalDate());
    }

    private static String stageOf(OrderEntity order, List<OrderItemEntity> items, int total, int completed) {
        if (order.getStatus() == OrderStatus.CANCELLED) {
            return AgentOrderStatusResponse.STAGE_CANCELLED;
        }
        if (total > 0 && completed == total) {
            return AgentOrderStatusResponse.STAGE_REPORT_READY;
        }
        boolean anyMovement = items.stream()
                .anyMatch(item -> item.getStatus() != SampleStatus.PENDING_COLLECTION);
        return anyMovement ? AgentOrderStatusResponse.STAGE_PROCESSING : AgentOrderStatusResponse.STAGE_RECEIVED;
    }

    /**
     * Sri Lankan numbers arrive in three shapes for the same phone: {@code 0771234567}
     * on the patient record, {@code 94771234567} as a WhatsApp id, {@code +94 77 123 4567}
     * typed by a human. Digits-only, last nine, is the stable core of all of them.
     */
    static boolean phoneMatches(String recordPhone, String requesterPhone) {
        String a = tail9(recordPhone);
        String b = tail9(requesterPhone);
        return a != null && a.equals(b);
    }

    private static String tail9(String phone) {
        if (phone == null) {
            return null;
        }
        String digits = phone.replaceAll("\\D", "");
        return digits.length() < 9 ? null : digits.substring(digits.length() - 9);
    }
}
