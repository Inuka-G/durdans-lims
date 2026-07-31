package com.uom.lims.api.critical.dto.request;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * Acknowledgment of a critical-value callback with a mandatory READ-BACK (H1).
 * The clinician repeats the value back ({@code readBackText}) and states to whom it
 * was communicated ({@code communicatedTo}) — a regulatory requirement
 * (CAP GEN.41350 / JCI IPSG.2), not a bare "acknowledged" flag.
 */
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AcknowledgeCriticalRequest {

    /** The result value the clinician repeated back. */
    private String readBackText;

    /** Who the critical value was communicated to (clinician / ward / on-call). */
    private String communicatedTo;

    /** True when the read-back matched the reported value. */
    private Boolean readBackVerified;
}
