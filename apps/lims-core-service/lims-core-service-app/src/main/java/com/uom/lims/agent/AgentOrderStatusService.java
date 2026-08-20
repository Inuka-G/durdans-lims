package com.uom.lims.agent;

import com.uom.lims.api.dto.response.AgentOrderStatusResponse;
import com.uom.lims.api.dto.response.AgentOrderStatusResponse.AgentOrderItemProgress;
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
import com.uom.lims.util.PiiMasker;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * WHY: answers "is my report ready" over WhatsApp without an OTP ceremony, by using the
 * one factor the channel proves by existing: possession of the phone. The caller passes
 * the WhatsApp sender's number, taken server-side from the conversation — never from
 * model output — and it must match the phone on the order's patient record.
 *
 * <p>Progress is derived from each item's newest sample, the same source of truth the
 * staff tracking view aggregates — {@code OrderItemEntity.status} is not advanced by
 * the workflow and reads as untouched long after testing has begun. The stages exposed
 * are a patient-facing coarsening: internal QA loops (a pathologist returning a result
 * for re-entry) all read as "verifying", because "your result was rejected" is a
 * sentence for a clinician to say, not a chatbot. The one internal state deliberately
 * surfaced is a rejected sample: recollection needs the patient to come back, so hiding
 * it would cost them a day.
 *
 * <p>The verification is conservative in what it reveals: a wrong order number and a
 * right order number on someone else's phone produce byte-identical responses.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AgentOrderStatusService {

    private static final ZoneId LAB_ZONE = ZoneId.of("Asia/Colombo");

    static final String ITEM_AWAITING_COLLECTION = "AWAITING_COLLECTION";
    static final String ITEM_COLLECTED = "COLLECTED";
    static final String ITEM_AT_LAB = "AT_LAB";
    static final String ITEM_TESTING = "TESTING";
    static final String ITEM_VERIFYING = "VERIFYING";
    static final String ITEM_READY = "READY";
    static final String ITEM_DISPATCHED = "DISPATCHED";
    static final String ITEM_RECOLLECTION_NEEDED = "RECOLLECTION_NEEDED";

    private final OrderRepository orderRepository;
    private final PatientRepository patientRepository;
    private final TestCatalogRepository testCatalogRepository;

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

        List<OrderItemEntity> items = order.getItems().stream()
                .filter(item -> !item.isDeleted())
                .toList();
        Map<UUID, TestCatalogEntity> testsById = testCatalogRepository
                .findAllById(items.stream().map(OrderItemEntity::getTestId).toList()).stream()
                .collect(Collectors.toMap(TestCatalogEntity::getId, Function.identity()));

        List<AgentOrderItemProgress> progress = new ArrayList<>();
        int completed = 0;
        for (OrderItemEntity item : items) {
            String itemStage = itemStage(newestSampleStatus(item));
            if (ITEM_READY.equals(itemStage) || ITEM_DISPATCHED.equals(itemStage)) {
                completed++;
            }
            TestCatalogEntity test = testsById.get(item.getTestId());
            progress.add(new AgentOrderItemProgress(
                    test == null ? "Laboratory test" : test.getTestName(), itemStage));
        }

        String stage = stageOf(order, progress, items.size(), completed);
        boolean ready = AgentOrderStatusResponse.STAGE_REPORT_READY.equals(stage);

        log.info("Agent order-status lookup: order {} -> {} ({}/{}) for {}",
                order.getOrderNo(), stage, completed, items.size(), PiiMasker.maskPhone(requesterPhone));

        return new AgentOrderStatusResponse(
                true,
                order.getOrderNo(),
                stage,
                ready,
                items.size(),
                completed,
                order.getCreatedAt() == null ? null : order.getCreatedAt().atZone(LAB_ZONE).toLocalDate(),
                progress);
    }

    /**
     * The item's newest non-deleted sample carries the live status; earlier samples on
     * the same item are superseded recollections. No sample at all means collection has
     * not started.
     */
    private static SampleStatus newestSampleStatus(OrderItemEntity item) {
        return item.getSamples().stream()
                .filter(sample -> !sample.isDeleted())
                .max(Comparator.comparing(SampleEntity::getCreatedAt,
                        Comparator.nullsFirst(Comparator.naturalOrder())))
                .map(SampleEntity::getStatus)
                .orElse(SampleStatus.PENDING_COLLECTION);
    }

    static String itemStage(SampleStatus status) {
        return switch (status) {
            case PENDING_COLLECTION -> ITEM_AWAITING_COLLECTION;
            case COLLECTED, IN_TRANSIT -> ITEM_COLLECTED;
            case RECEIVED_AT_LAB, QUALITY_CHECK, ACCEPTED -> ITEM_AT_LAB;
            case IN_TESTING, RESULT_ENTERED -> ITEM_TESTING;
            case SENT_FOR_VERIFICATION, VERIFIED -> ITEM_VERIFYING;
            case AUTHORIZED -> ITEM_READY;
            case DISPATCHED -> ITEM_DISPATCHED;
            case REJECTED, RECOLLECTION_REQUIRED -> ITEM_RECOLLECTION_NEEDED;
        };
    }

    private static String stageOf(OrderEntity order, List<AgentOrderItemProgress> progress,
                                  int total, int completed) {
        if (order.getStatus() == OrderStatus.CANCELLED) {
            return AgentOrderStatusResponse.STAGE_CANCELLED;
        }
        if (total > 0 && completed == total) {
            return AgentOrderStatusResponse.STAGE_REPORT_READY;
        }
        boolean anyMovement = progress.stream()
                .anyMatch(item -> !ITEM_AWAITING_COLLECTION.equals(item.stage()));
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
