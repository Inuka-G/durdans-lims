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
public class PreviousVisitSummaryResponse {
    private String resultId;
    /** Human-readable case number of that visit (RES<year>-<sequence>). */
    private String resultNo;
    private String sampleId;
    private String status;
    /** Specimen priority for that visit (STAT, URGENT, NORMAL). */
    private String priorityLevel;
    private Instant visitedAt;
    private Integer parameterCount;
    private Integer abnormalCount;
    private Integer criticalCount;
}
