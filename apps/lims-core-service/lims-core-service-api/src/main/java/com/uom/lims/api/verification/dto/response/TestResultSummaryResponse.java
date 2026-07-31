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
public class TestResultSummaryResponse {
    private String resultId;
    private String status;
    private String patientName;
    private String testType;
    private String mltName;
    private String qcStatus;
    /** Highest-severity result flag among submitted parameters. */
    private String flag;
    /** Specimen / order urgency from accessioning (STAT, URGENT, NORMAL). */
    private String priorityLevel;
    /** True if any parameter on this specimen has a critical panic flag. */
    private Boolean hasCriticalFinding;
    private Instant createdAt;
    private Instant updatedAt;
    private String technicianName;
    private String pathologistName;
    private String returnReason;
}
