package com.uom.lims.api.verification.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

/**
 * One case (specimen) on the bulk technical-approval worklist, with enough
 * context for a supervisor to approve it from a card without opening it.
 */
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BulkVerificationCaseResponse {
    /** Anchor result id — the id the case is approved or reviewed through. */
    private String resultId;
    private String resultNo;
    private String sampleId;
    private String sampleBarcode;
    private String patientCode;
    private String patientName;
    private String priorityLevel;
    /** Aggregate workflow status of the case (ENTERED, RETURNED_FOR_RECHECK, ...). */
    private String status;
    /** Highest-severity flag across the case's parameters. */
    private String flag;
    private Boolean hasCriticalFinding;
    /** True when every parameter is NORMAL and ENTERED — eligible for instant approval. */
    private boolean safeForApproval;
    private Instant updatedAt;
    private int parameterCount;
    /** First few parameters, in panel display order, for the card preview. */
    private List<BulkVerificationParameterPreviewResponse> parameters;
}
