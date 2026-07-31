package com.uom.lims.api.verification.dto.request;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * Request to correct a released result (H2). A mandatory reason and an explicit
 * signature confirmation are required (CLIA/CAP); {@code newFlag} is optional — when
 * blank the flag is recomputed from the parameter's reference/critical limits.
 */
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ResultAmendmentRequest {

    private String newValue;

    private String newFlag;

    private String amendmentReason;

    private Boolean signatureConfirmed;
}
