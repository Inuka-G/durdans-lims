package com.uom.lims.api.dto.request;

/**
 * The agent's identity step-up. {@code phone} is the WhatsApp sender or caller number
 * as the agent service saw it — possession. {@code identityNumber} and {@code fullName}
 * are what the patient told the agent — knowledge. All three must agree with one
 * patient record before anything is returned.
 */
public record AgentPatientVerifyRequest(
        String phone,
        String identityNumber,
        String fullName) {
}
