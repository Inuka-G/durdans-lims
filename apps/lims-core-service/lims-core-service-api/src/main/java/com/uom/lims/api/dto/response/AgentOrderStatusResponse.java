package com.uom.lims.api.dto.response;

import java.time.LocalDate;

/**
 * The coarse order status the WhatsApp agent may relay to a patient.
 *
 * <p>Deliberately carries no test names, no values, no reference ranges — not even the
 * list of what was ordered. The patient already knows what they ordered; the channel
 * only needs to answer "is it ready". This is the boundary that keeps the agent inside
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
        LocalDate orderedOn) {

    public static final String STAGE_RECEIVED = "RECEIVED";
    public static final String STAGE_PROCESSING = "PROCESSING";
    public static final String STAGE_REPORT_READY = "REPORT_READY";
    public static final String STAGE_CANCELLED = "CANCELLED";

    public static AgentOrderStatusResponse notFound() {
        return new AgentOrderStatusResponse(false, null, null, false, 0, 0, null);
    }
}
