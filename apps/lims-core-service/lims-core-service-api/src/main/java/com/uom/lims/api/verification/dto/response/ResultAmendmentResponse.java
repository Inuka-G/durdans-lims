package com.uom.lims.api.verification.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.time.Instant;

/**
 * One entry in a result's amendment history (H2): what the value/flag/status was, what
 * it became, who changed it, why, and when.
 */
@Getter
@Builder
public class ResultAmendmentResponse {

    private String amendmentId;
    private String resultId;
    private Integer versionNo;

    private String previousValue;
    private String previousFlag;
    private String previousStatus;

    private String newValue;
    private String newFlag;

    private String amendmentReason;
    private String amendedBy;
    private Instant amendedAt;
    private String signature;
}
