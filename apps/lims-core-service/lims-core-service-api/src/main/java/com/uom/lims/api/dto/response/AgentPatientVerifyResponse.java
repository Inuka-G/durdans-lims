package com.uom.lims.api.dto.response;

import java.util.List;

/**
 * What the WhatsApp agent learns about a caller who has proved who they are.
 *
 * <p>Two factors: possession (the WhatsApp number is the phone on the patient record)
 * and knowledge (the caller stated the name and identity number on that record). Only
 * once both hold does this carry anything — the patient's first name to address them
 * by and their recent orders, each in the same patient-facing shape as a single order
 * status lookup. Unverified is {@code verified=false} and nothing else, whether the
 * phone is unknown, the identity number is wrong, or the name does not match; the
 * three are deliberately indistinguishable from outside.
 *
 * <p>Never values, never reference ranges, never staff names — the same boundary as
 * {@link AgentOrderStatusResponse}.
 */
public record AgentPatientVerifyResponse(
        boolean verified,
        String firstName,
        List<AgentOrderStatusResponse> recentOrders) {

    public static AgentPatientVerifyResponse notVerified() {
        return new AgentPatientVerifyResponse(false, null, List.of());
    }
}
