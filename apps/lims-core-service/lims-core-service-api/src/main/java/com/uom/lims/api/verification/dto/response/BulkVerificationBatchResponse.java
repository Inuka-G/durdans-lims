package com.uom.lims.api.verification.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BulkVerificationBatchResponse {
    private String batchId;
    private String batchName;
    private String batchCode;
    private String department;
    private int totalResults;
    private int safeForApproval;
    private int exceptions;
    private Instant updatedAt;
    /** Anchor result ids of the cases that are safe for one-click approval. */
    private List<String> resultIds;
    /** Anchor result ids of the cases held for case-by-case review. */
    private List<String> reviewResultIds;
    /** One entry per case (specimen) in this test group, safe and held alike. */
    private List<BulkVerificationCaseResponse> cases;
}
