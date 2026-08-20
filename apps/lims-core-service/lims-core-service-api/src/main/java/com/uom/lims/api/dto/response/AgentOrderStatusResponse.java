package com.uom.lims.api.dto.response;

import java.time.LocalDate;
import java.util.List;

/**
 * The order progress the WhatsApp agent may relay to a patient.
 *
 * <p>Carries test names and per-test stages — the patient ordered these tests and has
 * already passed the possession check — but never values, reference ranges, staff
 * names or barcodes. "How far along is it" is patient information; "what did it say"
 * and "who touched it" are not. This is the boundary that keeps the agent inside
 * WhatsApp's health-information policy and the PDPA's special-category handling.
 *
 * <p>{@code found=false} covers an unknown order number and an identity mismatch alike,
 * on purpose: distinguishing them would tell a guesser which order numbers exist.
 */
public record AgentOrderStatusResponse(
        boolean found,
        String orderNo,
        String stage,
        boolean reportReady,
        int totalTests,
        int testsCompleted,
        LocalDate orderedOn,
        List<AgentOrderItemProgress> items) {

    public static final String STAGE_RECEIVED = "RECEIVED";
    public static final String STAGE_PROCESSING = "PROCESSING";
    public static final String STAGE_REPORT_READY = "REPORT_READY";
    public static final String STAGE_CANCELLED = "CANCELLED";

    /**
     * One test's progress in patient-facing stages, derived from the item's newest
     * sample: AWAITING_COLLECTION, COLLECTED, AT_LAB, TESTING, VERIFYING, READY,
     * DISPATCHED, or RECOLLECTION_NEEDED — the one stage that asks the patient to act.
     */
    public record AgentOrderItemProgress(String testName, String stage) {
    }

    public static AgentOrderStatusResponse notFound() {
        return new AgentOrderStatusResponse(false, null, null, false, 0, 0, null, List.of());
    }
}
