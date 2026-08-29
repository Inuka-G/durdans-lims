package com.uom.lims.api.verification.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TestResultParameterResponse {
    private String parameterCode;
    private String parameterName;
    private BigDecimal resultValue;
    private String resultText;
    private String unit;
    private BigDecimal referenceRangeLow;
    private BigDecimal referenceRangeHigh;
    private String flag;

    // ---- Delta check against the patient's most recent released value for the
    // same parameter (previous visit). Null when there is no prior value. ----

    /** The prior released value as entered (text form). */
    private String previousValue;
    /** Flag the prior value carried. */
    private String previousFlag;
    /** When the prior specimen was collected (falls back to its creation time). */
    private Instant previousVisitedAt;
    /** Barcode of the prior specimen, for traceability. */
    private String previousSampleBarcode;
    /** current - previous, when both are numeric. */
    private BigDecimal deltaAbsolute;
    /** Signed percent change vs the previous value, when both are numeric and previous != 0. */
    private BigDecimal deltaPercent;
    /** True when |deltaPercent| exceeds the lab's delta-check threshold. */
    private Boolean deltaSignificant;
}
