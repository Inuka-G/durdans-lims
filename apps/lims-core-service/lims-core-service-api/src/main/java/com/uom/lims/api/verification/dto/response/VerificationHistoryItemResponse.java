package com.uom.lims.api.verification.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VerificationHistoryItemResponse {
    private String resultId;
    /** Human-readable case number (RES<year>-<sequence>) of the result the action was taken on. */
    private String resultNo;
    private String actionType;
    /** Patient the audited action was performed on; resolved from the result's sample. */
    private String patientCode;
    private String patientName;
    private String testName;
    /** Specimen priority captured at audit time (STAT, URGENT, NORMAL). */
    private String specimenPriority;
    private String actionSummary;
    private String performedBy;
    private Instant actionAt;
    private String notes;
    private Instant updatedAt;
}
